/**
 * WebSocket 连接管理 Store（Cookie 直通版）
 *
 * 文件：src/store/modules/ws.ts
 *
 * 变更：token → openId
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useUserStore } from './user'
import { useInfoStore } from './info'
import { getOpenId } from '@/utils/cookie-manager'
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
        const openId = getOpenId()

        if (!openId) {
            console.log('[WS Store] 无 openId，不连接')
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
            openId,
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
                console.warn('[WS Store] 收到 AUTH_REQUIRED，断开连接（需要重新登录）')
                disconnect()
                break

            case 'HEARTBEAT':
                break

            default:
                infoStore.handleWsMessage(msg)
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
    }
})
