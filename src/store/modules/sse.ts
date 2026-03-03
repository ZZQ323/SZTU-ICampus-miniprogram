/**
 * 全局 SSE 状态管理（带持久化）
 * 由于小程序每个页面是独立的 webview，所以使用 Pinia store 共享状态
 * 文件：src/store/modules/sse.ts
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { sseClient } from '@/utils/sse'
import { useUserStore } from './user'

// ==================== 存储 Key ====================

const STORAGE_KEY_LAST_READ_ID = 'announcement_last_read_id'
const STORAGE_KEY_READ_IDS = 'announcement_read_ids'
const MAX_READ_IDS = 200

// ==================== 类型定义 ====================

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

    /** 是否正在重连 */
    const isReconnecting = ref(false)

    // ==================== 公告相关状态（持久化） ====================

    /** 服务端最新公告 ID */
    const serverLatestId = ref<string>('0')

    /** 用户已读的最新 ID（持久化） */
    const lastReadId = ref<string>(loadLastReadId())

    /** 用户已读的 ID 集合（持久化，用于处理非连续 ID） */
    const readIds = ref<Set<string>>(new Set(loadReadIds()))

    // ==================== 日历相关状态 ====================

    const calendarUnread = ref(0)

    // ==================== 内部变量 ====================

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null

    // ==================== 计算属性 ====================

    /** 公告未读数 */
    const announcementUnread = computed(() => {
        const latest = Number(serverLatestId.value) || 0
        const lastRead = Number(lastReadId.value) || 0

        if (latest <= lastRead) return 0

        // 简单计算差值（实际中可能不连续，但足够用于显示）
        const diff = latest - lastRead
        return Math.min(diff, 99)
    })

    /** 是否有未读 */
    const hasUnread = computed(() => announcementUnread.value > 0 || calendarUnread.value > 0)

    /** 总未读数 */
    const totalUnread = computed(() => announcementUnread.value + calendarUnread.value)

    // ==================== 持久化监听 ====================

    // 监听 lastReadId 变化，自动保存
    watch(lastReadId, (newVal) => {
        saveLastReadId(newVal)
    })

    // 监听 readIds 变化，自动保存
    watch(readIds, (newVal) => {
        saveReadIds(Array.from(newVal))
    }, { deep: true })

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

        sseClient.subscribe('announcement', (message: SseMessageData) => {
            handleMessage('announcement', message)
        })

        isConnected.value = true
        reconnectAttempts.value = 0
        lastHeartbeat.value = Date.now()

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
        console.log('[SSE Store] 收到消息:', topic, message.type, message.data)

        switch (message.type) {
            case 'HEARTBEAT':
                lastHeartbeat.value = Date.now()
                break

            case 'NEW_ANNOUNCEMENTS':
                // 新公告通知
                if (message.data?.latestId) {
                    serverLatestId.value = message.data.latestId
                }
                // 注意：未读数由 computed 自动计算，无需手动增加
                break

            case 'ANNOUNCEMENT_STATUS':
                // 公告系统状态（连接时推送）
                if (message.data?.latestId) {
                    serverLatestId.value = message.data.latestId
                }
                break

            case 'AUTH_REQUIRED':
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

    // ==================== 未读标记方法 ====================

    /**
     * 标记所有公告已读（进入公告列表页时调用）
     */
    function markAllAnnouncementRead() {
        if (serverLatestId.value && serverLatestId.value !== '0') {
            lastReadId.value = serverLatestId.value
            console.log('[SSE Store] 标记全部已读:', lastReadId.value)
        }
    }

    /**
     * 标记单条公告已读（查看详情时调用）
     */
    function markAnnouncementItemRead(id: string) {
        readIds.value.add(id)

        // 如果这个 ID 比 lastReadId 大，更新 lastReadId
        const idNum = Number(id) || 0
        const lastReadNum = Number(lastReadId.value) || 0
        if (idNum > lastReadNum) {
            lastReadId.value = id
        }

        // 限制存储数量
        if (readIds.value.size > MAX_READ_IDS) {
            const arr = Array.from(readIds.value).sort((a, b) => Number(b) - Number(a))
            readIds.value = new Set(arr.slice(0, MAX_READ_IDS))
        }
    }

    /**
     * 检查某条公告是否已读
     */
    function isAnnouncementRead(id: string): boolean {
        const idNum = Number(id) || 0
        const lastReadNum = Number(lastReadId.value) || 0

        // ID 小于等于 lastReadId 的都算已读
        if (idNum <= lastReadNum) return true

        // 或者在 readIds 集合中
        return readIds.value.has(id)
    }

    /**
     * 标记日历已读
     */
    function markCalendarRead() {
        calendarUnread.value = 0
    }

    /**
     * 检查并恢复连接
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
        isReconnecting,
        serverLatestId,
        lastReadId,
        calendarUnread,

        // 计算属性
        announcementUnread,
        hasUnread,
        totalUnread,

        // 方法
        connect,
        disconnect,
        checkAndReconnect,

        // 未读标记
        markAllAnnouncementRead,
        markAnnouncementItemRead,
        isAnnouncementRead,
        markCalendarRead,
    }
})

// ==================== 持久化辅助函数 ====================

function loadLastReadId(): string {
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
        console.warn('[SSE Store] 保存 lastReadId 失败:', e)
    }
}

function loadReadIds(): string[] {
    try {
        const data = uni.getStorageSync(STORAGE_KEY_READ_IDS)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

function saveReadIds(ids: string[]): void {
    try {
        uni.setStorageSync(STORAGE_KEY_READ_IDS, JSON.stringify(ids))
    } catch (e) {
        console.warn('[SSE Store] 保存 readIds 失败:', e)
    }
}