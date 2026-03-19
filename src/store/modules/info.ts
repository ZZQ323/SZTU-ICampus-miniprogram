/**
 * 统一信息状态管理 Store（三层分治版）
 *
 * 文件：src/store/modules/info.ts
 *
 * ⭐ 修改点：
 *   1. init() 检查 hasLocalToken 再请求（防 401 风暴）
 *   2. 加锁 + 失败标记（防并发 + 防重试）
 *   3. 不再自己管 token（那是 TokenManager 的事）
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { infoApi } from '@/api/info-api'
import { hasLocalToken } from '@/utils/token-manager'
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

    const channelStates = ref<Record<string, ChannelUnreadState>>({
        announcement: createChannelState('announcement'),
        news: createChannelState('news'),
        activity: createChannelState('activity'),
        job: createChannelState('job'),
    })

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
            saveToStorage(STORAGE_READ_IDS(channelId), Array.from(state.readIds))
        }
    }, { deep: true })

    // ==================== 方法 ====================

    /**
     * 初始化（拉取最新 ID）
     *
     * ⭐ 三道防护：
     *   1. 无 token → 跳过
     *   2. 正在初始化 → 跳过
     *   3. 上次认证失败 → 跳过（直到 resetInitState）
     */
    async function init() {
        if (!hasLocalToken()) return
        if (_initing) return
        if (_authFailed) return

        _initing = true
        try {
            const result = await infoApi.getLatestId('announcement')
            if (result?.latestId) {
                updateServerLatestId('announcement', result.latestId)
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
            infoApi.markRead({ channelId, latestId: state.lastReadId }).catch(() => { })
            updateTabBarBadge()
        }
    }

    function markItemRead(channelId: string, id: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]
        state.readIds.add(id)
        const idNum = Number(id) || 0
        const lastReadNum = Number(state.lastReadId) || 0
        if (idNum > lastReadNum) state.lastReadId = id
        if (state.readIds.size > MAX_READ_IDS) {
            const arr = Array.from(state.readIds).sort((a, b) => Number(b) - Number(a)).slice(0, MAX_READ_IDS)
            state.readIds = new Set(arr)
        }
    }

    function isItemRead(channelId: string, id: string): boolean {
        const state = channelStates.value[channelId]
        if (!state) return false
        if ((Number(id) || 0) <= (Number(state.lastReadId) || 0)) return true
        return state.readIds.has(id)
    }

    function getUnreadCount(channelId: string): number {
        return unreadCounts.value[channelId] || 0
    }

    function handleWsMessage(message: WsMessage) {
        switch (message.type) {
            case 'NEW_ANNOUNCEMENTS':
            case 'ANNOUNCEMENT_STATUS':
            case 'ANNOUNCEMENT_DATA':
                if (message.data?.latestId) updateServerLatestId('announcement', message.data.latestId)
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
        return {
            serverLatestId: '0',
            lastReadId: loadFromStorage(STORAGE_LAST_READ(channelId), '0'),
            readIds: new Set(loadFromStorage(STORAGE_READ_IDS(channelId), [])),
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