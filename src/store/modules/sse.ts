/**
 * 全局 SSE 状态管理
 * 
 * 文件：src/store/modules/sse.ts
 * 
 * 由于小程序每个页面是独立的 webview，所以使用 Pinia store 共享状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sseClient } from '@/utils/sse'
import { useUserStore } from './user'

/** SSE 消息类型 */
interface SseMessageData {
    type: string
    data: any
    timestamp?: number
}

export const useSseStore = defineStore('sse', () => {
    // ==================== 状态 ====================

    /** 是否已连接 */
    const isConnected = ref(false)

    /** 最后心跳时间 */
    const lastHeartbeat = ref(0)

    /** 重连次数 */
    const reconnectAttempts = ref(0)

    /** 公告未读数 */
    const announcementUnread = ref(0)

    /** 最新公告 ID */
    const latestAnnouncementId = ref('0')

    /** 日历未读数 */
    const calendarUnread = ref(0)

    /** 是否正在重连 */
    const isReconnecting = ref(false)

    // ==================== 内部变量 ====================

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null

    // ==================== 计算属性 ====================

    const hasUnread = computed(() => announcementUnread.value > 0 || calendarUnread.value > 0)
    const totalUnread = computed(() => announcementUnread.value + calendarUnread.value)

    // ==================== 方法 ====================

    /**
     * 连接 SSE
     */
    function connect() {
        const userStore = useUserStore()

        if (!userStore.isSchoolLoggedIn) {
            console.log('[SSE Store] 用户未登录，不连接')
            return
        }

        if (isConnected.value) {
            console.log('[SSE Store] 已连接，跳过')
            return
        }

        console.log('[SSE Store] 开始连接...')

        // 订阅公告流
        sseClient.subscribe('announcement', (message: SseMessageData) => {
            handleMessage('announcement', message)
        })

        isConnected.value = true
        reconnectAttempts.value = 0
        lastHeartbeat.value = Date.now()

        // 启动心跳检测
        startHeartbeatCheck()
    }

    /**
     * 断开 SSE
     */
    function disconnect() {
        console.log('[SSE Store] 断开连接')

        sseClient.unsubscribe('announcement')

        isConnected.value = false
        stopHeartbeatCheck()

        if (reconnectTimer) {
            clearTimeout(reconnectTimer)
            reconnectTimer = null
        }
    }

    /**
     * 处理 SSE 消息
     */
    function handleMessage(topic: string, message: SseMessageData) {
        console.log('[SSE Store] 收到消息:', topic, message)

        switch (message.type) {
            case 'HEARTBEAT':
                lastHeartbeat.value = Date.now()
                break

            case 'NEW_ANNOUNCEMENTS':
                // 新公告通知
                if (message.data?.count) {
                    announcementUnread.value += message.data.count
                }
                if (message.data?.latestId) {
                    latestAnnouncementId.value = message.data.latestId
                }
                break

            case 'ANNOUNCEMENT_STATUS':
                // 公告系统状态
                if (message.data?.latestId) {
                    latestAnnouncementId.value = message.data.latestId
                }
                break

            case 'AUTH_REQUIRED':
                // 需要重新登录
                disconnect()
                break
        }
    }

    /**
     * 启动心跳检测
     */
    function startHeartbeatCheck() {
        stopHeartbeatCheck()

        heartbeatCheckTimer = setInterval(() => {
            const now = Date.now()
            const elapsed = now - lastHeartbeat.value

            // 30 秒无心跳，触发重连
            if (elapsed > 30000 && isConnected.value) {
                console.log('[SSE Store] 心跳超时，触发重连')
                triggerReconnect()
            }
        }, 5000)
    }

    /**
     * 停止心跳检测
     */
    function stopHeartbeatCheck() {
        if (heartbeatCheckTimer) {
            clearInterval(heartbeatCheckTimer)
            heartbeatCheckTimer = null
        }
    }

    /**
     * 触发重连
     */
    function triggerReconnect() {
        if (isReconnecting.value) return

        isReconnecting.value = true
        isConnected.value = false

        // 指数退避：1s, 2s, 4s, 8s, 最大 30s
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000)
        reconnectAttempts.value++

        console.log(`[SSE Store] ${delay / 1000}s 后重连 (第 ${reconnectAttempts.value} 次)`)

        reconnectTimer = setTimeout(() => {
            isReconnecting.value = false

            const userStore = useUserStore()
            if (userStore.isSchoolLoggedIn) {
                disconnect()
                connect()
            }
        }, delay)
    }

    /**
     * 标记公告已读
     */
    function markAnnouncementRead() {
        announcementUnread.value = 0
    }

    /**
     * 标记日历已读
     */
    function markCalendarRead() {
        calendarUnread.value = 0
    }

    /**
     * 检查并恢复连接（页面 onShow 时调用）
     */
    function checkAndReconnect() {
        const userStore = useUserStore()

        if (userStore.isSchoolLoggedIn && !isConnected.value && !isReconnecting.value) {
            console.log('[SSE Store] 检测到断连，尝试重连')
            connect()
        }
    }

    return {
        // 状态
        isConnected,
        lastHeartbeat,
        reconnectAttempts,
        announcementUnread,
        latestAnnouncementId,
        calendarUnread,
        isReconnecting,

        // 计算属性
        hasUnread,
        totalUnread,

        // 方法
        connect,
        disconnect,
        markAnnouncementRead,
        markCalendarRead,
        checkAndReconnect,
    }
})