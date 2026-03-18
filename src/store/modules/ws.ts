/**
 * WebSocket 连接管理 Store
 *
 * 文件：src/store/modules/ws.ts
 *
 * 替代原 sse.ts：
 * - 使用真实 WebSocket（uni.connectSocket），不是轮询
 * - 收到消息后转发给 infoStore.handleWsMessage()
 * - Token 过期时收到 AUTH_REQUIRED，触发 refresh 流程后重连
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useUserStore } from './user'
import { useInfoStore } from './info'
import { WsClient } from '@/utils/websocket'
import type { WsConnectionState, WsMessage } from '@/utils/websocket'

export const useWsStore = defineStore('ws', () => {
    // ==================== 状态 ====================

    const connectionState = ref<WsConnectionState>('disconnected')
    const reconnectAttempts = ref(0)

    // ==================== 计算属性 ====================

    const isConnected = computed(() => connectionState.value === 'connected')
    const isConnecting = computed(() =>
        connectionState.value === 'connecting' || connectionState.value === 'reconnecting'
    )

    // ==================== 私有 ====================

    let client: WsClient | null = null

    // ==================== 方法 ====================

    /**
     * 建立 WebSocket 连接
     * 在登录成功 / App onShow 时调用
     */
    function connect() {
        const userStore = useUserStore()

        if (!userStore.token) {
            console.log('[WS Store] 无 token，不连接')
            return
        }

        // 如果已连接，不重复连接
        if (client && connectionState.value === 'connected') {
            console.log('[WS Store] 已连接')
            return
        }

        // 如果有旧 client，先断开
        if (client) {
            client.disconnect()
            client = null
        }

        const baseUrl = getWsBaseUrl()

        client = new WsClient({
            baseUrl,
            token: userStore.token!,
            topics: ['announcement', 'schedule', 'calendar'],
            onMessage: handleMessage,
            onStateChange: (state) => {
                connectionState.value = state
            },
            maxReconnect: 5,
            reconnectDelay: 3000,
        })

        client.connect()
    }

    /**
     * 断开连接
     * 在退出登录时调用
     */
    function disconnect() {
        if (client) {
            client.disconnect()
            client = null
        }
        connectionState.value = 'disconnected'
    }

    /**
     * 用新 token 重连
     * 在 token 刷新成功后调用
     */
    function reconnectWithNewToken(newToken: string) {
        if (client) {
            client.reconnectWithNewToken(newToken)
        } else {
            connect()
        }
    }

    /**
     * 手动重连
     */
    function reconnect() {
        disconnect()
        connect()
    }

    // ==================== 消息处理 ====================

    function handleMessage(msg: WsMessage) {
        const infoStore = useInfoStore()
        const userStore = useUserStore()

        console.log('[WS Store] 收到消息:', msg.type)

        switch (msg.type) {
            case 'CONNECTED':
                console.log('[WS Store] 服务端确认连接:', msg.message)
                break

            case 'AUTH_REQUIRED':
                // Token 过期，触发刷新
                console.warn('[WS Store] 收到 AUTH_REQUIRED，需刷新 token')
                handleAuthRequired()
                break

            case 'HEARTBEAT':
                break

            case 'NEW_ANNOUNCEMENTS':
            case 'ANNOUNCEMENT_DATA':
            case 'ANNOUNCEMENT_STATUS':
            case 'SCHEDULE_DATA':
            case 'CALENDAR_DATA':
                // 转发给 infoStore 统一处理
                infoStore.handleWsMessage(msg)
                break

            default:
                console.log('[WS Store] 未知消息类型:', msg.type)
                // 也转发，让 infoStore 决定是否处理
                infoStore.handleWsMessage(msg)
        }
    }

    async function handleAuthRequired() {
        const userStore = useUserStore()

        try {
            // 走 token refresh 流程
            const newToken = await userStore.refreshToken()
            if (newToken && client) {
                client.reconnectWithNewToken(newToken)
            }
        } catch (e) {
            console.error('[WS Store] token 刷新失败，断开 WS')
            disconnect()
        }
    }

    // ==================== 工具 ====================

    function getWsBaseUrl(): string {
        // 从 HTTP base URL 推导 WS URL
        const httpBase = import.meta.env.VITE_API_BASE_URL || ''

        if (httpBase.startsWith('https://')) {
            return httpBase.replace('https://', 'wss://')
        } else if (httpBase.startsWith('http://')) {
            return httpBase.replace('http://', 'ws://')
        }

        // 默认用当前域名
        return httpBase
    }

    // ==================== 自动连接/断开 ====================

    // 监听登录状态：登录后自动连接，登出后自动断开
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
        { immediate: false }  // 不立即执行，等明确登录后再连
    )

    // ==================== 返回 ====================

    return {
        connectionState,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        reconnect,
        reconnectWithNewToken,
    }
})