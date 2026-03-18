/**
 * 统一信息状态管理 Store（WebSocket 版）
 *
 * 文件：src/store/modules/info.ts
 *
 * 改造点：
 * - handleSseMessage → handleWsMessage
 * - 消息类型对齐后端 StreamKeys（NEW_ANNOUNCEMENTS / SCHEDULE_DATA 等）
 * - sseConnected → wsConnected（语义更新）
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { infoApi } from '@/api/info-api'
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

    /** WebSocket 连接状态（原 sseConnected） */
    const wsConnected = ref(false)

    /** 新消息（浮窗 + 红点用） */
    const newMessage = ref<any>(null)

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

    async function init() {
        try {
            const result = await infoApi.getLatestId('announcement')
            if (result?.latestId) {
                updateServerLatestId('announcement', result.latestId)
            }
        } catch (e) {
            console.warn('[Info Store] 初始化失败', e)
        }
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
            newMessage.value = {
                channelId,
                latestId,
                count: newLatest - oldLatest,
            }

            // 更新 TabBar 红点
            updateTabBarBadge()
        }

        state.serverLatestId = latestId
    }

    function markChannelRead(channelId: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]

        if (state.serverLatestId && state.serverLatestId !== '0') {
            state.lastReadId = state.serverLatestId
            console.log(`[Info Store] 标记 ${channelId} 全部已读:`, state.lastReadId)

            infoApi.markRead({ channelId, latestId: state.lastReadId })
                .catch(e => console.warn('[Info Store] 同步已读状态失败', e))

            // 清除 TabBar 红点
            updateTabBarBadge()
        }
    }

    function markItemRead(channelId: string, id: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]
        state.readIds.add(id)

        const idNum = Number(id) || 0
        const lastReadNum = Number(state.lastReadId) || 0
        if (idNum > lastReadNum) {
            state.lastReadId = id
        }

        if (state.readIds.size > MAX_READ_IDS) {
            const arr = Array.from(state.readIds)
                .sort((a, b) => Number(b) - Number(a))
                .slice(0, MAX_READ_IDS)
            state.readIds = new Set(arr)
        }
    }

    function isItemRead(channelId: string, id: string): boolean {
        const state = channelStates.value[channelId]
        if (!state) return false
        const idNum = Number(id) || 0
        const lastReadNum = Number(state.lastReadId) || 0
        if (idNum <= lastReadNum) return true
        return state.readIds.has(id)
    }

    function getUnreadCount(channelId: string): number {
        return unreadCounts.value[channelId] || 0
    }

    /**
     * ★ 处理 WebSocket 消息（核心替换点）
     *
     * 由 ws.ts store 转发调用。消息类型对应后端 StreamKeys：
     * - NEW_ANNOUNCEMENTS → 新公告通知
     * - ANNOUNCEMENT_STATUS → 公告系统状态
     * - SCHEDULE_DATA → 课表数据
     * - CALENDAR_DATA → 日历数据
     */
    function handleWsMessage(message: WsMessage) {
        console.log('[Info Store] WS 消息:', message.type, message.data)

        switch (message.type) {
            case 'NEW_ANNOUNCEMENTS':
            case 'ANNOUNCEMENT_STATUS':
            case 'ANNOUNCEMENT_DATA':
                if (message.data?.latestId) {
                    updateServerLatestId('announcement', message.data.latestId)
                }
                break

            case 'SCHEDULE_DATA':
                // TODO: 课表推送处理
                break

            case 'CALENDAR_DATA':
                // TODO: 日历推送处理
                break

            case 'HEARTBEAT':
            case 'CONNECTED':
                break

            default:
                console.log('[Info Store] 未处理消息类型:', message.type)
        }
    }

    function clearNewMessage() {
        newMessage.value = null
    }

    // ==================== TabBar 红点 ====================

    function updateTabBarBadge() {
        const count = totalUnread.value
        try {
            if (count > 0) {
                uni.setTabBarBadge({
                    index: 2,  // 公告 tab 的 index（根据你的 tabBar 配置调整）
                    text: count > 99 ? '99+' : String(count),
                })
            } else {
                uni.removeTabBarBadge({ index: 2 })
            }
        } catch (e) {
            // 非 tabBar 页面调用会报错，忽略
        }
    }

    // ==================== 内部方法 ====================

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

    // ==================== 返回 ====================

    return {
        channelStates,
        categoryTree,
        wsConnected,
        newMessage,

        unreadCounts,
        totalUnread,
        hasUnread,
        announcementUnread,

        init,
        loadCategoryTree,
        updateServerLatestId,
        markChannelRead,
        markItemRead,
        isItemRead,
        getUnreadCount,
        handleWsMessage,     // ★ 原 handleSseMessage
        clearNewMessage,
    }
})

// ==================== 辅助 ====================

function loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
        const data = uni.getStorageSync(key)
        if (data) {
            return typeof defaultValue === 'string' ? data : JSON.parse(data)
        }
    } catch (e) {
        console.warn('[Info Store] 读取存储失败:', key, e)
    }
    return defaultValue
}

function saveToStorage(key: string, value: any): void {
    try {
        const data = typeof value === 'string' ? value : JSON.stringify(value)
        uni.setStorageSync(key, data)
    } catch (e) {
        console.warn('[Info Store] 保存存储失败:', key, e)
    }
}