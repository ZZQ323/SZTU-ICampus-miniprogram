/**
 * WebSocket 连接管理 Store（Cookie 直通版）
 *
 * 文件：src/store/modules/ws.ts
 *
 * 变更：token → userId（学号）
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useUserStore } from './user'
import { useInfoStore } from './info'
import { getUserId, mergeSchoolCookies } from '@/utils/cookie-manager'
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
        const userId = getUserId()

        if (!userId) {
            console.log('[WS Store] 无 userId，不连接')
            return
        }

        // 防止竞态：connecting / reconnecting / connected 状态都不再新建连接
        if (client && connectionState.value !== 'disconnected') {
            console.log('[WS Store] 已在连接中，跳过:', connectionState.value)
            return
        }

        if (client) {
            client.disconnect()
            client = null
        }

        const baseUrl = getWsBaseUrl()

        client = new WsClient({
            baseUrl,
            userId,
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

            case 'COOKIE_UPDATE': {
                // 后端爬虫过程中学校 cookie 轮换时，StreamPushService.pushCookieUpdate
                // 会通过 WS 下发最新 cookie；前端必须落盘，否则后续 HTTP 请求还会用旧 cookie。
                // 历史 bug：这条 case 原本缺失，消息掉进 default 分支丢给 info.store 但被
                // 那边的 switch 吞没（它只处理 NEW_ANNOUNCEMENTS / NEW_CONTENT 等）。
                const cookiesJson = (msg as any)?.data?.cookiesJson
                if (typeof cookiesJson === 'string' && cookiesJson.length > 0) {
                    // 合并而非替换：后端爬虫只回推轮换过的 key，其它 cookie（如 TWFID）
                    // 前端必须保留原值，否则下一次 HTTP 请求会缺 key 被学校拒。
                    mergeSchoolCookies(cookiesJson)
                    console.log('[WS Store] 已应用 COOKIE_UPDATE（合并），本地 cookie 刷新')
                } else {
                    console.warn('[WS Store] COOKIE_UPDATE payload 无 cookiesJson，忽略')
                }
                break
            }

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
