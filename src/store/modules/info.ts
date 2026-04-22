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
import { useSubscriptionStore } from './subscription'
import { useUserStore } from './user'

// ==================== 存储 Key ====================

const STORAGE_PREFIX = 'info_'
const STORAGE_LAST_READ = (channelId: string) => `${STORAGE_PREFIX}last_read_${channelId}`
const STORAGE_READ_IDS = (channelId: string) => `${STORAGE_PREFIX}read_ids_${channelId}`
const MAX_READ_IDS = 200

// ==================== 推送队列 ====================

/** 推送队列单条（文章级） */
export interface ToastItem {
    articleId: string
    channelId: string
    sourceOrgName?: string
    /** 只有批次头部有真实标题，其他条目用 "${sourceOrgName} · 新动态" 兜底 */
    title?: string
    receivedAt: number
}

/** 队列上限（超出按时间 FIFO 截断）*/
const MAX_QUEUE_SIZE = 20

/** 徽章模式：number（有推送队列，显示数字）/ dot（无队列但有未读文章）/ none（完全已读）*/
export type BadgeMode = 'number' | 'dot' | 'none'
export interface Badge { mode: BadgeMode; value?: number }

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

    /**
     * 推送队列（仅内存，不持久化）
     *   入队条件：用户处于"登录态"（isSchoolLoggedIn=true）时的 WS 推送
     *   清空时机：登录态从 true → false 的那一刻（登出 / 被挤 / cookie 失效）
     *   上限：MAX_QUEUE_SIZE，超出按 FIFO 截断
     *   顺序：receivedAt desc（最新在最前）
     */
    const toastQueue = ref<ToastItem[]>([])

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

    /**
     * 任意频道是否有"未读文章"（serverLatestId > lastReadId）。
     * 用于红点降级模式：队列清空且用户本地仍有未读时显示红点。
     */
    const hasAnyUnread = computed(() =>
        Object.values(unreadCounts.value).some(n => n > 0)
    )

    /**
     * 统一徽章：FAB / TabBar / 首页 2×2 同源消费。
     *   queue.length > 0 → number（登录态下持续积累）
     *   else hasAnyUnread → dot（离线/初始状态的降级展示）
     *   else             → none（全部已读）
     */
    const badge = computed<Badge>(() => {
        if (toastQueue.value.length > 0) {
            return { mode: 'number', value: toastQueue.value.length }
        }
        if (hasAnyUnread.value) return { mode: 'dot' }
        return { mode: 'none' }
    })

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

    function updateServerLatestId(channelId: string, latestId: string, extra?: { sourceName?: string; title?: string }) {
        ensureChannelState(channelId)
        const state = channelStates.value[channelId]
        const oldLatest = Number(state.serverLatestId) || 0
        const newLatest = Number(latestId) || 0

        if (newLatest > oldLatest && oldLatest > 0) {
            newMessage.value = {
                channelId,
                latestId,
                count: newLatest - oldLatest,
                sourceName: extra?.sourceName,
                title: extra?.title,
            }
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
        // 通用格式：message.data 包含 { channelId, latestId, sourceId?, sourceOrgName?, latestTitle?, ids?: string[], ... }
        const channelId = message.data?.channelId
        const latestId = message.data?.latestId
        const sourceId = message.data?.sourceId
        const sourceOrgName = message.data?.sourceOrgName
        const latestTitle = message.data?.latestTitle
        const ids: string[] = message.data?.ids || (latestId ? [latestId] : [])

        // 订阅过滤：非空订阅集合内的 sourceId 才通过；空集 / payload 缺 sourceId 都放行（减噪但不阻断）
        const subscription = useSubscriptionStore()
        if (!subscription.isEmpty && sourceId && !subscription.isSubscribed(sourceId)) {
            return
        }

        const extra = { sourceName: sourceOrgName, title: latestTitle }

        switch (message.type) {
            case 'NEW_ANNOUNCEMENTS':
            case 'ANNOUNCEMENT_STATUS':
            case 'ANNOUNCEMENT_DATA':
            case 'NEW_CONTENT':
                // 统一处理：抬水位线 + 入队（若登录态）
                if (latestId) {
                    updateServerLatestId(channelId || 'announcement', latestId, extra)
                }
                // 仅登录态才入队（未登录下 WS 理论上不会连，但加道保险）
                if (isLoggedInForQueue() && ids.length > 0) {
                    for (const id of ids) {
                        enqueueToast({
                            articleId: String(id),
                            channelId: channelId || 'announcement',
                            sourceOrgName,
                            title: String(id) === String(latestId) ? latestTitle : undefined,
                            receivedAt: Date.now(),
                        })
                    }
                }
                break
        }
    }

    function clearNewMessage() { newMessage.value = null }

    // ==================== 推送队列操作 ====================

    function isLoggedInForQueue(): boolean {
        try {
            return useUserStore().isSchoolLoggedIn === true
        } catch {
            return false
        }
    }

    /** 入队：新条目放队首，重复 articleId 去重（保留最新 receivedAt），超限 FIFO 截断 */
    function enqueueToast(item: ToastItem) {
        const existingIdx = toastQueue.value.findIndex(t => t.articleId === item.articleId)
        if (existingIdx >= 0) {
            // 已存在 → 提到队首并刷新 title（若新的有 title）
            const existing = toastQueue.value[existingIdx]
            const merged: ToastItem = {
                ...existing,
                title: item.title || existing.title,
                receivedAt: item.receivedAt,
            }
            toastQueue.value.splice(existingIdx, 1)
            toastQueue.value.unshift(merged)
        } else {
            toastQueue.value.unshift(item)
        }
        if (toastQueue.value.length > MAX_QUEUE_SIZE) {
            toastQueue.value.splice(MAX_QUEUE_SIZE)
        }
        updateTabBarBadge()
    }

    /** 单条删除（用户点 ✗ 或点击跳转后） */
    function dismissToast(articleId: string) {
        const idx = toastQueue.value.findIndex(t => t.articleId === articleId)
        if (idx >= 0) {
            toastQueue.value.splice(idx, 1)
            updateTabBarBadge()
        }
    }

    /** 清空整个队列（用户点"全部已读"或登录态中断触发） */
    function clearToastQueue() {
        if (toastQueue.value.length === 0) return
        toastQueue.value = []
        updateTabBarBadge()
    }

    /**
     * 所有频道"全部已读"：把每个频道的 lastReadId 推到 serverLatestId，
     * 红点消除。通常和 clearToastQueue 一起用（让徽章直接归 none）。
     */
    function markAllChannelsRead() {
        for (const channelId of Object.keys(channelStates.value)) {
            markChannelRead(channelId)
        }
    }

    // ==================== TabBar 徽章（信息流 tab，index=2）====================

    /**
     * 和 FAB / home 2x2 同源：队列非空 → 数字；空但有未读 → 红点；全部已读 → 无
     * 小程序的 tabBar 原生 badge 不支持同时设数字+红点，我们优先数字。
     */
    function updateTabBarBadge() {
        const b = badge.value
        try {
            if (b.mode === 'number') {
                uni.setTabBarBadge({ index: 2, text: (b.value || 0) > 99 ? '99+' : String(b.value) })
                // 数字模式不需要红点
                try { (uni as any).hideTabBarRedDot?.({ index: 2 }) } catch { /* ignore */ }
            } else if (b.mode === 'dot') {
                uni.removeTabBarBadge({ index: 2 })
                try { (uni as any).showTabBarRedDot?.({ index: 2 }) } catch { /* ignore */ }
            } else {
                uni.removeTabBarBadge({ index: 2 })
                try { (uni as any).hideTabBarRedDot?.({ index: 2 }) } catch { /* ignore */ }
            }
        } catch { /* 非 tabBar 页面会报错 */ }
    }

    // ==================== 登录态断点监听 ====================

    // 登录态从 true → false 时清空队列（降级为红点模式）
    try {
        const userStore = useUserStore()
        watch(() => userStore.isSchoolLoggedIn, (now, before) => {
            if (before && !now) {
                clearToastQueue()
            }
        })
    } catch { /* store 未初始化完时忽略 */ }

    // badge 任何变化都同步一次 tabBar（兜底：handleWsMessage / enqueueToast 也会调）
    watch(badge, () => updateTabBarBadge(), { immediate: false })

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
        unreadCounts, totalUnread, hasUnread, hasAnyUnread, announcementUnread,
        // 统一徽章 + 队列
        badge, toastQueue,
        enqueueToast, dismissToast, clearToastQueue, markAllChannelsRead,
        // 原有
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