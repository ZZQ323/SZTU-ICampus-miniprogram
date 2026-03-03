/**
 * 公告状态管理 Hook
 * 
 * 文件：src/hooks/useAnnouncement.ts
 * 
 * 职责：
 * - 管理公告已读状态（本地存储）
 * - 计算未读数量
 * - 订阅 SSE 新公告通知
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { announcementApi } from '@/api/announcement-apis'
import { sseClient } from '@/utils/sse'
import type { AnnouncementMeta, NewAnnouncementMessage } from '@/types/announcement'

// ==================== 常量 ====================

const STORAGE_KEY_LAST_READ_ID = 'announcement_last_read_id'
const STORAGE_KEY_READ_IDS = 'announcement_read_ids'
const MAX_READ_IDS = 100 // 最多记录100条已读

// ==================== Hook ====================

export function useAnnouncement() {
    // ==================== 状态 ====================

    /** 服务器最新公告ID */
    const latestId = ref<string>('0')

    /** 用户上次已读的最新ID */
    const lastReadId = ref<string>(getLastReadId())

    /** 已读的公告ID集合 */
    const readIds = ref<Set<string>>(new Set(getReadIds()))

    /** 新公告缓存（SSE 推送的） */
    const newAnnouncements = ref<AnnouncementMeta[]>([])

    /** SSE 连接状态 */
    const sseConnected = ref(false)

    // ==================== 计算属性 ====================

    /** 是否有未读公告 */
    const hasUnread = computed(() => {
        const latest = Number(latestId.value) || 0
        const lastRead = Number(lastReadId.value) || 0
        return latest > lastRead
    })

    /** 未读数量（近似值，基于 latestId 差值） */
    const unreadCount = computed(() => {
        if (!hasUnread.value) return 0
        const latest = Number(latestId.value) || 0
        const lastRead = Number(lastReadId.value) || 0
        const diff = latest - lastRead
        return Math.min(diff, 99)
    })

    // ==================== 方法 ====================

    async function init() {
        try {
            const result = await announcementApi.getLatestId()
            latestId.value = result.latestId || '0'
        } catch (e) {
            console.warn('[useAnnouncement] 获取最新ID失败', e)
        }
    }

    function markAsRead(id?: string) {
        const targetId = id || latestId.value
        if (!targetId || targetId === '0') return

        const current = Number(lastReadId.value) || 0
        const target = Number(targetId) || 0
        if (target > current) {
            lastReadId.value = targetId
            saveLastReadId(targetId)
        }

        readIds.value.add(targetId)
        saveReadIds(Array.from(readIds.value))
        newAnnouncements.value = []
    }

    function markItemAsRead(id: string) {
        readIds.value.add(id)
        saveReadIds(Array.from(readIds.value))
    }

    function isRead(id: string): boolean {
        const idNum = Number(id) || 0
        const lastReadNum = Number(lastReadId.value) || 0
        if (idNum <= lastReadNum) return true
        return readIds.value.has(id)
    }

    function subscribeSSE() {
        sseClient.subscribe(
            'announcement',
            (data, eventType) => {
                console.log('[useAnnouncement] SSE 收到消息:', eventType, data)

                if (data.type === 'NEW_ANNOUNCEMENTS') {
                    const msg = data as NewAnnouncementMessage
                    latestId.value = msg.latestId
                    newAnnouncements.value = msg.metas || []

                    if (msg.count > 0) {
                        uni.showToast({
                            title: `${msg.count} 条新公告`,
                            icon: 'none',
                            duration: 2000
                        })
                    }
                }

                if (data.type === 'ANNOUNCEMENT_STATUS') {
                    latestId.value = data.latestId || latestId.value
                }
            },
            (error) => {
                console.error('[useAnnouncement] SSE 错误:', error)
                sseConnected.value = false
            },
            (status) => {
                sseConnected.value = status === 'connected'
            }
        )
    }

    function unsubscribeSSE() {
        sseClient.unsubscribe('announcement')
        sseConnected.value = false
    }

    onMounted(() => {
        init()
    })

    onUnmounted(() => {
        unsubscribeSSE()
    })

    return {
        latestId,
        lastReadId,
        newAnnouncements,
        sseConnected,
        hasUnread,
        unreadCount,
        init,
        markAsRead,
        markItemAsRead,
        isRead,
        subscribeSSE,
        unsubscribeSSE,
    }
}

// ==================== 本地存储辅助函数 ====================

function getLastReadId(): string {
    try {
        return uni.getStorageSync(STORAGE_KEY_LAST_READ_ID) || '0'
    } catch {
        return '0'
    }
}

function saveLastReadId(id: string): void {
    try {
        uni.setStorageSync(STORAGE_KEY_LAST_READ_ID, id)
    } catch (e) {
        console.warn('[useAnnouncement] 保存 lastReadId 失败', e)
    }
}

function getReadIds(): string[] {
    try {
        const data = uni.getStorageSync(STORAGE_KEY_READ_IDS)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

function saveReadIds(ids: string[]): void {
    try {
        const trimmed = ids.slice(-MAX_READ_IDS)
        uni.setStorageSync(STORAGE_KEY_READ_IDS, JSON.stringify(trimmed))
    } catch (e) {
        console.warn('[useAnnouncement] 保存 readIds 失败', e)
    }
}

export default useAnnouncement