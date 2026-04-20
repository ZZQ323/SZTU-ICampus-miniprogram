/**
 * 统一信息状态管理 Store（三层分治版）
 *
 * 文件：src/store/modules/info.ts
 *
 * 三层分治模型：
 *   serverLatestId: 服务器最新 ID（API / WS 推送）
 *   lastReadId:     已读位置（本地持久化）
 *   readIds:        单条已读集合（本地持久化，上限 200）
 *
 * ⭐ 修改点：
 *   1. channelStates 包含所有实际使用的频道（announcement, academic, campus-life, news）
 *   2. init() 拉取所有频道的 latestId
 *   3. isItemRead() 调用 ensureChannelState() 保证 state 始终存在
 *   4. handleWsMessage 扩展到所有频道
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { infoApi } from '@/api/info-api'
import { hasAuth } from '@/utils/cookie-manager'
import type { CategoryTree, ChannelUnreadState } from '@/types/info'
import type { WsMessage } from '@/utils/websocket'

// ==================== 存储 Key ====================

const STORAGE_PREFIX = 'info_'
const STORAGE_LAST_READ = (channelId: string) => `${STORAGE_PREFIX}last_read_${channelId}`
const STORAGE_READ_IDS = (channelId: string) => `${STORAGE_PREFIX}read_ids_${channelId}`
const MAX_READ_IDS = 200

// ==================== Store ====================

export const useInfoStore = defineStore('info', () => {
    // ==================== 状态 ====================

    /** 固定频道（公文通始终追踪未读状态） */
    const DEFAULT_CHANNELS = ['announcement']

    const channelStates = ref<Record<string, ChannelUnreadState>>(
        Object.fromEntries(DEFAULT_CHANNELS.map(id => [id, createChannelState(id)]))
    )

    const categoryTree = ref<CategoryTree | null>(null)
    const wsConnected = ref(false)
    const newMessage = ref<any>(null)

    /** 防并发 */
    let _initing = false
    /** 认证失败后停止重试 */
    let _authFailed = false

    // ==================== 计算属性 ====================

    const unreadCounts = computed(() => {
        const result: Record<string, number> = {}
        for (const [channelId, state] of Object.entries(channelStates.value)) {
            const latest = Number(state.serverLatestId) || 0
            const lastRead = Number(state.lastReadId) || 0
            result[channelId] = latest <= lastRead ? 0 : Math.min(latest - lastRead, 99)
        }
        return result
    })

    const totalUnread = computed(() =>
        Object.values(unreadCounts.value).reduce((a, b) => a + b, 0)
    )

    const hasUnread = computed(() => totalUnread.value > 0)
    const announcementUnread = computed(() => unreadCounts.value.announcement || 0)

    // ==================== 持久化 ====================

    watch(channelStates, (newVal) => {
        for (const [channelId, state] of Object.entries(newVal)) {
            saveToStorage(STORAGE_LAST_READ(channelId), state.lastReadId)
            saveToStorage(STORAGE_READ_IDS(channelId), Object.keys(state.readIds))
        }
    }, { deep: true })

    // ==================== 方法 ====================

    /**
     * 初始化（拉取最新 ID）
     *   1. 正在初始化 → 跳过
     *   2. 上次认证失败 → 跳过（直到 resetInitState）
     */
    async function init() {
        if (!hasAuth()) return
        if (_initing) return
        if (_authFailed) return

        _initing = true
        try {
            // 一次拉取所有频道的 latestId（批量接口）
            const allLatest = await infoApi.getLatestAll()
            if (allLatest) {
                for (const [channelId, latestId] of Object.entries(allLatest)) {
                    if (latestId && latestId !== '0') {
                        updateServerLatestId(channelId, latestId)
                    }
                }
            }
            _authFailed = false
        } catch (e: any) {
            console.warn('[Info Store] 初始化失败:', e?.message)
            if (e?.code === 401 || e?.code === 403) {
                _authFailed = true
            }
        } finally {
            _initing = false
        }
    }

    /** 重置失败标记（登录成功后调用） */
    function resetInitState() {
        _authFailed = false
        _initing = false
    }

    async function loadCategoryTree() {
        if (categoryTree.value) return categoryTree.value
        try {
            const result = await infoApi.getCategoryTree()
            categoryTree.value = result
            return result
        } catch (e) {
            console.error('[Info Store] 加载分类树失败', e)
            return null
        }
    }

    function updateServerLatestId(channelId: string, latestId: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]
        const oldLatest = Number(state.serverLatestId) || 0
        const newLatest = Number(latestId) || 0

        if (newLatest > oldLatest && oldLatest > 0) {
            newMessage.value = { channelId, latestId, count: newLatest - oldLatest }
            updateTabBarBadge()
        }
        state.serverLatestId = latestId
    }

    function markChannelRead(channelId: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]
        if (state.serverLatestId && state.serverLatestId !== '0') {
            state.lastReadId = state.serverLatestId
            // infoApi.markRead({ channelId, latestId: state.lastReadId }).catch(() => { })
            updateTabBarBadge()
        }
    }

    function markItemRead(channelId: string, id: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]
        const key = String(id)
        state.readIds[key] = true
        // 水位线自然随点击抬升（未读角标据此收敛）。
        // 注意：isItemRead 不使用 lastReadId 做视觉判断，所以不会殃及更旧的未点文章。
        const idNum = Number(key) || 0
        const lastReadNum = Number(state.lastReadId) || 0
        if (idNum > lastReadNum) state.lastReadId = key
        const keys = Object.keys(state.readIds)
        if (keys.length > MAX_READ_IDS) {
            const kept = keys.sort((a, b) => Number(b) - Number(a)).slice(0, MAX_READ_IDS)
            const next: Record<string, true> = {}
            for (const k of kept) next[k] = true
            state.readIds = next
        }
    }

    function isItemRead(channelId: string, id: string): boolean {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]
        // 视觉已读仅看 readIds；lastReadId 水位线只用于未读计数，不参与视觉判断
        return state.readIds[String(id)] === true
    }

    function getUnreadCount(channelId: string): number {
        return unreadCounts.value[channelId] || 0
    }

    function handleWsMessage(message: WsMessage) {
        // 通用格式：message.data 包含 { channelId, latestId, ... }
        const channelId = message.data?.channelId
        const latestId = message.data?.latestId

        switch (message.type) {
            case 'NEW_ANNOUNCEMENTS':
            case 'ANNOUNCEMENT_STATUS':
            case 'ANNOUNCEMENT_DATA':
                // 兼容旧格式（无 channelId 字段，默认 announcement）
                if (latestId) updateServerLatestId(channelId || 'announcement', latestId)
                break
            case 'NEW_CONTENT':
                // 新的通用推送格式（所有频道统一）
                if (channelId && latestId) updateServerLatestId(channelId, latestId)
                break
        }
    }

    function clearNewMessage() { newMessage.value = null }

    // ==================== TabBar 红点 ====================

    function updateTabBarBadge() {
        const count = totalUnread.value
        try {
            if (count > 0) {
                uni.setTabBarBadge({ index: 2, text: count > 99 ? '99+' : String(count) })
            } else {
                uni.removeTabBarBadge({ index: 2 })
            }
        } catch { /* 非 tabBar 页面会报错 */ }
    }

    // ==================== 内部 ====================

    function ensureChannelState(channelId: string) {
        if (!channelStates.value[channelId]) {
            channelStates.value[channelId] = createChannelState(channelId)
        }
    }

    function createChannelState(channelId: string): ChannelUnreadState {
        const storedIds = loadFromStorage<string[]>(STORAGE_READ_IDS(channelId), [])
        const readIds: Record<string, true> = {}
        for (const id of storedIds) readIds[String(id)] = true
        return {
            serverLatestId: '0',
            lastReadId: loadFromStorage(STORAGE_LAST_READ(channelId), '0'),
            readIds,
        }
    }

    return {
        channelStates, categoryTree, wsConnected, newMessage,
        unreadCounts, totalUnread, hasUnread, announcementUnread,
        init, resetInitState, loadCategoryTree,
        updateServerLatestId, markChannelRead, markItemRead,
        isItemRead, getUnreadCount, handleWsMessage, clearNewMessage,
    }
})

// ==================== 辅助 ====================

function loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
        const data = uni.getStorageSync(key)
        if (data) return typeof defaultValue === 'string' ? data : JSON.parse(data)
    } catch { /* ignore */ }
    return defaultValue
}

function saveToStorage(key: string, value: any): void {
    try {
        uni.setStorageSync(key, typeof value === 'string' ? value : JSON.stringify(value))
    } catch { /* ignore */ }
}