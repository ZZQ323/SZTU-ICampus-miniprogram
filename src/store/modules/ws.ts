/**
 * WebSocket 连接管理 Store
 *
 * 文件：src/store/modules/ws.ts
 *
 * ★ 修改点：watch immediate: false → true
 *   确保启动时如果已登录，WS 立即连接
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

    // ==================== 计算属性 ====================

    const isConnected = computed(() => connectionState.value === 'connected')
    const isConnecting = computed(() =>
        connectionState.value === 'connecting' || connectionState.value === 'reconnecting'
    )

    // ==================== 私有 ====================

    let client: WsClient | null = null

    // ==================== 方法 ====================

    function connect() {
        const userStore = useUserStore()

        if (!userStore.token) {
            console.log('[WS Store] 无 token，不连接')
            return
        }

        if (client && connectionState.value === 'connected') {
            console.log('[WS Store] 已连接')
            return
        }

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

    function disconnect() {
        if (client) {
            client.disconnect()
            client = null
        }
        connectionState.value = 'disconnected'
    }

    function reconnectWithNewToken(newToken: string) {
        if (client) {
            client.reconnectWithNewToken(newToken)
        } else {
            connect()
        }
    }

    function reconnect() {
        disconnect()
        connect()
    }

    // ==================== 消息处理 ====================

    function handleMessage(msg: WsMessage) {
        const infoStore = useInfoStore()

        console.log('[WS Store] 收到消息:', msg.type)

        switch (msg.type) {
            case 'CONNECTED':
                console.log('[WS Store] 服务端确认连接:', msg.message)
                break

            case 'AUTH_REQUIRED':
                console.warn('[WS Store] 收到 AUTH_REQUIRED，需刷新 token')
                handleAuthRequired()
                break

            case 'HEARTBEAT':
                break

            default:
                // 所有业务消息转发给 infoStore
                infoStore.handleWsMessage(msg)
        }
    }

    async function handleAuthRequired() {
        const userStore = useUserStore()
        try {
            // refreshTokenIfNeeded 返回 boolean，不是 token 字符串
            const success = await userStore.refreshTokenIfNeeded()
            if (success && userStore.token) {
                // 刷新成功后，从 store 取新 token
                client?.reconnectWithNewToken(userStore.token)
            } else {
                disconnect()
            }
        } catch (e) {
            console.error('[WS Store] token 刷新失败，断开 WS')
            disconnect()
        }
    }

    // ==================== 工具 ====================

    function getWsBaseUrl(): string {
        const httpBase = import.meta.env.VITE_API_BASE_URL || 'http://192.168.3.35:8080'

        if (httpBase.startsWith('https://')) {
            return httpBase.replace('https://', 'wss://')
        } else if (httpBase.startsWith('http://')) {
            return httpBase.replace('http://', 'ws://')
        }

        return httpBase
    }

    // ==================== 自动连接/断开 ====================

    // ★ immediate: true → 启动时如果已登录就立即连接
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
        connectionState,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        reconnect,
        reconnectWithNewToken,
    }
})