/**
 * 统一信息状态管理 Store
 * 
 * 文件：src/store/modules/info.ts
 * 
 * 功能：
 * 1. 管理多频道未读状态
 * 2. 分类树缓存
 * 3. 已读状态持久化
 * 4. SSE 消息处理
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { infoApi } from '@/api/info-api'
import type { CategoryTree, ChannelUnreadState } from '@/types/info'

// ==================== 存储 Key ====================

const STORAGE_PREFIX = 'info_'
const STORAGE_LAST_READ = (channelId: string) => `${STORAGE_PREFIX}last_read_${channelId}`
const STORAGE_READ_IDS = (channelId: string) => `${STORAGE_PREFIX}read_ids_${channelId}`
const MAX_READ_IDS = 200

// ==================== Store ====================

export const useInfoStore = defineStore('info', () => {
    // ==================== 状态 ====================

    /** 各频道的未读状态 */
    const channelStates = ref<Record<string, ChannelUnreadState>>({
        announcement: createChannelState('announcement'),
        news: createChannelState('news'),
        activity: createChannelState('activity'),
        job: createChannelState('job'),
    })

    /** 分类树（从后端获取，缓存） */
    const categoryTree = ref<CategoryTree | null>(null)

    /** SSE 连接状态 */
    const sseConnected = ref(false)

    /** 新消息（用于浮窗显示） */
    const newMessage = ref<any>(null)

    // ==================== 计算属性 ====================

    /** 各频道未读数 */
    const unreadCounts = computed(() => {
        const result: Record<string, number> = {}

        for (const [channelId, state] of Object.entries(channelStates.value)) {
            const latest = Number(state.serverLatestId) || 0
            const lastRead = Number(state.lastReadId) || 0

            if (latest <= lastRead) {
                result[channelId] = 0
            } else {
                result[channelId] = Math.min(latest - lastRead, 99)
            }
        }

        return result
    })

    /** 总未读数 */
    const totalUnread = computed(() => {
        return Object.values(unreadCounts.value).reduce((a, b) => a + b, 0)
    })

    /** 是否有未读 */
    const hasUnread = computed(() => totalUnread.value > 0)

    /** 公告未读数（兼容旧代码） */
    const announcementUnread = computed(() => unreadCounts.value.announcement || 0)

    // ==================== 持久化监听 ====================

    // 监听状态变化，自动保存
    watch(channelStates, (newVal) => {
        for (const [channelId, state] of Object.entries(newVal)) {
            saveToStorage(STORAGE_LAST_READ(channelId), state.lastReadId)
            saveToStorage(STORAGE_READ_IDS(channelId), Array.from(state.readIds))
        }
    }, { deep: true })

    // ==================== 方法 ====================

    /**
     * 初始化（获取最新 ID）
     */
    async function init() {
        try {
            // 获取各频道最新 ID
            const result = await infoApi.getLatestId('announcement')
            if (result?.latestId) {
                updateServerLatestId('announcement', result.latestId)
            }
        } catch (e) {
            console.warn('[Info Store] 初始化失败', e)
        }
    }

    /**
     * 加载分类树
     */
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

    /**
     * 更新服务端最新 ID（SSE 推送时调用）
     */
    function updateServerLatestId(channelId: string, latestId: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]

        // 检测是否有新消息
        const oldLatest = Number(state.serverLatestId) || 0
        const newLatest = Number(latestId) || 0

        if (newLatest > oldLatest && oldLatest > 0) {
            // 触发新消息事件
            newMessage.value = {
                channelId,
                latestId,
                count: newLatest - oldLatest,
            }
        }

        state.serverLatestId = latestId
    }

    /**
     * 标记频道全部已读（进入列表页时调用）
     */
    function markChannelRead(channelId: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]

        if (state.serverLatestId && state.serverLatestId !== '0') {
            state.lastReadId = state.serverLatestId
            console.log(`[Info Store] 标记 ${channelId} 全部已读:`, state.lastReadId)

            // 同步到后端
            infoApi.markRead({
                channelId,
                latestId: state.lastReadId,
            }).catch(e => console.warn('[Info Store] 同步已读状态失败', e))
        }
    }

    /**
     * 标记单条已读（查看详情时调用）
     */
    function markItemRead(channelId: string, id: string) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]

        // 添加到已读集合
        state.readIds.add(id)

        // 如果这个 ID 比 lastReadId 大，更新
        const idNum = Number(id) || 0
        const lastReadNum = Number(state.lastReadId) || 0
        if (idNum > lastReadNum) {
            state.lastReadId = id
        }

        // 限制存储数量
        if (state.readIds.size > MAX_READ_IDS) {
            const arr = Array.from(state.readIds)
                .sort((a, b) => Number(b) - Number(a))
                .slice(0, MAX_READ_IDS)
            state.readIds = new Set(arr)
        }
    }

    /**
     * 检查单条是否已读
     */
    function isItemRead(channelId: string, id: string): boolean {
        const state = channelStates.value[channelId]
        if (!state) return false

        const idNum = Number(id) || 0
        const lastReadNum = Number(state.lastReadId) || 0

        // ID <= lastReadId 的都算已读
        if (idNum <= lastReadNum) return true

        // 或者在已读集合中
        return state.readIds.has(id)
    }

    /**
     * 获取频道未读数
     */
    function getUnreadCount(channelId: string): number {
        return unreadCounts.value[channelId] || 0
    }

    /**
     * 处理 SSE 消息
     */
    function handleSseMessage(message: any) {
        console.log('[Info Store] SSE 消息:', message.type, message.data)

        switch (message.type) {
            case 'NEW_ANNOUNCEMENTS':
            case 'ANNOUNCEMENT_STATUS':
                if (message.data?.latestId) {
                    updateServerLatestId('announcement', message.data.latestId)
                }
                break

            case 'NEW_NEWS':
                if (message.data?.latestId) {
                    updateServerLatestId('news', message.data.latestId)
                }
                break

            case 'NEW_ACTIVITY':
                if (message.data?.latestId) {
                    updateServerLatestId('activity', message.data.latestId)
                }
                break

            case 'HEARTBEAT':
                // 心跳不处理
                break
        }
    }

    /**
     * 清除新消息（浮窗关闭后）
     */
    function clearNewMessage() {
        newMessage.value = null
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
        // 状态
        channelStates,
        categoryTree,
        sseConnected,
        newMessage,

        // 计算属性
        unreadCounts,
        totalUnread,
        hasUnread,
        announcementUnread,  // 兼容

        // 方法
        init,
        loadCategoryTree,
        updateServerLatestId,
        markChannelRead,
        markItemRead,
        isItemRead,
        getUnreadCount,
        handleSseMessage,
        clearNewMessage,
    }
})

// ==================== 辅助函数 ====================

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