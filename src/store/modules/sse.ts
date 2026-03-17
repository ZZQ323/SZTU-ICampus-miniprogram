/**
 * SSE 连接管理 Store（更新版）
 * 
 * 文件：src/store/modules/sse.ts
 * 
 * 更新点：
 * 1. 收到 SSE 消息时调用 infoStore.handleSseMessage
 * 2. 心跳处理中检查 Token 状态
 * 3. 支持多频道消息类型
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useUserStore } from './user'
import { useInfoStore } from './info'

// ==================== 类型定义 ====================

interface SseMessage {
    type: 'announcement' | 'news' | 'activity' | 'heartbeat' | 'connected' | 'error'
    data?: {
        latestId?: string
        count?: number
        title?: string
        sourceName?: string
        channelId?: string
    }
    timestamp?: number
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

// ==================== Store 定义 ====================

export const useSseStore = defineStore('sse', () => {
    // ==================== 状态 ====================

    const connectionState = ref<ConnectionState>('disconnected')
    const lastHeartbeat = ref<number>(0)
    const reconnectAttempts = ref(0)
    const eventSource = ref<UniApp.RequestTask | null>(null)

    // ==================== 配置 ====================

    const MAX_RECONNECT_ATTEMPTS = 5
    const RECONNECT_DELAY_BASE = 3000 // 基础重连延迟 3 秒
    const HEARTBEAT_TIMEOUT = 60000 // 心跳超时 60 秒

    // ==================== 计算属性 ====================

    const isConnected = computed(() => connectionState.value === 'connected')
    const isConnecting = computed(() =>
        connectionState.value === 'connecting' || connectionState.value === 'reconnecting'
    )

    // ==================== 私有变量 ====================

    let heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    // ==================== 方法 ====================

    /**
     * 连接 SSE
     */
    function connect() {
        const userStore = useUserStore()

        // 检查登录状态
        if (!userStore.isSchoolLoggedIn) {
            console.log('[SSE] 未登录，不连接')
            return
        }

        // 避免重复连接
        if (connectionState.value === 'connecting' || connectionState.value === 'connected') {
            console.log('[SSE] 已连接或正在连接')
            return
        }

        connectionState.value = reconnectAttempts.value > 0 ? 'reconnecting' : 'connecting'

        const token = userStore.token
        const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
        const sseUrl = `${baseUrl}/sse/v1/subscribe?token=${encodeURIComponent(token || '')}`

        console.log('[SSE] 开始连接...', { attempt: reconnectAttempts.value })

        // 使用 uni.request 的 EventSource 模式（或自定义实现）
        // 注意：小程序不支持原生 EventSource，需要使用 RequestTask 或长轮询
        // 这里使用简化的轮询方案
        startPolling(sseUrl)
    }

    /**
     * 轮询模拟 SSE（小程序兼容方案）
     */
    function startPolling(url: string) {
        const userStore = useUserStore()
        const infoStore = useInfoStore()

        // 停止之前的轮询
        stopPolling()

        const poll = async () => {
            if (connectionState.value === 'disconnected') return

            try {
                const response = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
                    uni.request({
                        url,
                        method: 'GET',
                        timeout: 30000,
                        success: resolve,
                        fail: reject,
                    })
                })

                if (response.statusCode === 200) {
                    connectionState.value = 'connected'
                    reconnectAttempts.value = 0
                    lastHeartbeat.value = Date.now()

                    // 处理消息
                    const data = response.data as SseMessage | SseMessage[]
                    const messages = Array.isArray(data) ? data : [data]

                    for (const msg of messages) {
                        handleMessage(msg)
                    }
                } else if (response.statusCode === 401) {
                    // Token 失效
                    console.warn('[SSE] Token 失效，断开连接')
                    disconnect()
                    userStore.setSchoolLoggedIn(false)
                    return
                }
            } catch (e) {
                console.error('[SSE] 轮询失败', e)
                handleConnectionError()
                return
            }

            // 继续轮询（5秒间隔）
            if (connectionState.value === 'connected') {
                reconnectTimer = setTimeout(poll, 5000)
            }
        }

        poll()
        startHeartbeatCheck()
    }

    /**
     * 停止轮询
     */
    function stopPolling() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer)
            reconnectTimer = null
        }
    }

    /**
     * 处理 SSE 消息
     */
    function handleMessage(msg: SseMessage) {
        const infoStore = useInfoStore()

        console.log('[SSE] 收到消息', msg)

        switch (msg.type) {
            case 'heartbeat':
                lastHeartbeat.value = Date.now()
                break

            case 'connected':
                console.log('[SSE] 连接成功')
                lastHeartbeat.value = Date.now()
                break

            case 'announcement':
            case 'news':
            case 'activity':
                // 转发给 infoStore 处理
                infoStore.handleSseMessage({
                    channelId: msg.type === 'announcement' ? 'announcement' : msg.type,
                    latestId: msg.data?.latestId,
                    count: msg.data?.count,
                    title: msg.data?.title,
                    sourceName: msg.data?.sourceName,
                })
                break

            case 'error':
                console.error('[SSE] 服务端错误', msg.data)
                break

            default:
                console.log('[SSE] 未知消息类型', msg)
        }
    }

    /**
     * 处理连接错误
     */
    function handleConnectionError() {
        connectionState.value = 'disconnected'

        if (reconnectAttempts.value < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts.value++
            const delay = RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts.value - 1)
            console.log(`[SSE] ${delay}ms 后重连...`)

            reconnectTimer = setTimeout(() => {
                connect()
            }, delay)
        } else {
            console.error('[SSE] 重连次数超限，停止重连')
        }
    }

    /**
     * 启动心跳检查
     */
    function startHeartbeatCheck() {
        stopHeartbeatCheck()

        heartbeatCheckTimer = setInterval(() => {
            const now = Date.now()
            if (lastHeartbeat.value > 0 && now - lastHeartbeat.value > HEARTBEAT_TIMEOUT) {
                console.warn('[SSE] 心跳超时，重连...')
                connectionState.value = 'disconnected'
                connect()
            }
        }, HEARTBEAT_TIMEOUT / 2)
    }

    /**
     * 停止心跳检查
     */
    function stopHeartbeatCheck() {
        if (heartbeatCheckTimer) {
            clearInterval(heartbeatCheckTimer)
            heartbeatCheckTimer = null
        }
    }

    /**
     * 断开连接
     */
    function disconnect() {
        console.log('[SSE] 断开连接')

        connectionState.value = 'disconnected'
        stopPolling()
        stopHeartbeatCheck()
        reconnectAttempts.value = 0
        lastHeartbeat.value = 0
    }

    /**
     * 重置并重连
     */
    function reconnect() {
        disconnect()
        reconnectAttempts.value = 0
        connect()
    }

    // ==================== 自动连接/断开 ====================

    // 监听登录状态变化
    const userStore = useUserStore()
    watch(
        () => userStore.isSchoolLoggedIn,
        (loggedIn) => {
            if (loggedIn) {
                connect()
            } else {
                disconnect()
            }
        },
        { immediate: true }
    )

    // ==================== 返回 ====================

    return {
        // 状态
        connectionState,
        lastHeartbeat,
        reconnectAttempts,

        // 计算属性
        isConnected,
        isConnecting,

        // 方法
        connect,
        disconnect,
        reconnect,
    }
})