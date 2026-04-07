/**
 * WebSocket 连接工具（Cookie 直通版）
 *
 * 文件：src/utils/websocket.ts
 *
 * 变更：token → userId（连接参数）
 */

type MessageCallback = (message: WsMessage) => void
type StateCallback = (state: WsConnectionState) => void

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface WsMessage<T = any> {
    type: string
    data?: T
    timestamp?: number
    targetUser?: string
    message?: string
}

interface WsOptions {
    /** 后端基础 URL（如 ws://192.168.1.100:8080 或 wss://xxx） */
    baseUrl: string
    /** userId（用户标识） */
    userId: string
    /** 订阅的 topic 列表 */
    topics?: string[]
    /** 消息回调 */
    onMessage?: MessageCallback
    /** 状态变化回调 */
    onStateChange?: StateCallback
    /** 最大重连次数 */
    maxReconnect?: number
    /** 重连基础延迟（ms） */
    reconnectDelay?: number
    /** 心跳间隔（ms），0 = 不发应用层心跳 */
    heartbeatInterval?: number
}

export class WsClient {
    private socket: UniApp.SocketTask | null = null
    private options: Required<WsOptions>
    private state: WsConnectionState = 'disconnected'
    private reconnectAttempts = 0
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private manualClose = false

    constructor(opts: WsOptions) {
        this.options = {
            baseUrl: opts.baseUrl,
            userId: opts.userId,
            topics: opts.topics || ['announcement'],
            onMessage: opts.onMessage || (() => { }),
            onStateChange: opts.onStateChange || (() => { }),
            maxReconnect: opts.maxReconnect ?? 5,
            reconnectDelay: opts.reconnectDelay ?? 3000,
            heartbeatInterval: opts.heartbeatInterval ?? 0,
        }
    }

    /** 建立连接 */
    connect() {
        if (this.state === 'connecting' || this.state === 'connected') {
            return
        }

        this.manualClose = false
        this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

        const topics = this.options.topics.join(',')
        const url = `${this.options.baseUrl}/ws?userId=${encodeURIComponent(this.options.userId)}&topics=${encodeURIComponent(topics)}`

        console.log('[WS] 连接中...', { attempt: this.reconnectAttempts, topics })

        this.socket = uni.connectSocket({
            url,
            success: () => {
                console.log('[WS] connectSocket 调用成功')
            },
            fail: (err) => {
                console.error('[WS] connectSocket 调用失败', err)
                this.handleError()
            },
        })

        this.socket.onOpen(() => {
            console.log('[WS] 连接建立')
            this.setState('connected')
            this.reconnectAttempts = 0
            this.startHeartbeat()
        })

        this.socket.onMessage((res) => {
            this.handleMessage(res.data as string)
        })

        this.socket.onClose((res) => {
            console.log('[WS] 连接关闭', res.code, res.reason)
            this.stopHeartbeat()
            this.setState('disconnected')

            if (!this.manualClose) {
                this.scheduleReconnect()
            }
        })

        this.socket.onError((err) => {
            console.error('[WS] 连接错误', err)
            this.handleError()
        })
    }

    /** 断开连接 */
    disconnect() {
        console.log('[WS] 手动断开')
        this.manualClose = true
        this.clearReconnect()
        this.stopHeartbeat()

        if (this.socket) {
            try {
                this.socket.close({})
            } catch (e) {
                // ignore
            }
            this.socket = null
        }

        this.setState('disconnected')
        this.reconnectAttempts = 0
    }

    /** 用新 userId 重连 */
    reconnectWithNewUserId(newUserId: string) {
        this.options.userId = newUserId
        this.reconnectAttempts = 0
        this.disconnect()
        this.manualClose = false
        this.connect()
    }

    getState(): WsConnectionState {
        return this.state
    }

    // ==================== 内部方法 ====================

    private handleMessage(raw: string) {
        if (raw === 'pong') return

        try {
            const msg: WsMessage = JSON.parse(raw)

            if (msg.type === 'AUTH_REQUIRED') {
                console.warn('[WS] 收到 AUTH_REQUIRED，需要重新登录')
            }

            this.options.onMessage(msg)
        } catch (e) {
            console.warn('[WS] 消息解析失败', raw)
        }
    }

    private handleError() {
        this.stopHeartbeat()
        if (this.state !== 'disconnected') {
            this.setState('disconnected')
        }
        if (!this.manualClose) {
            this.scheduleReconnect()
        }
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnect) {
            console.error('[WS] 重连次数超限，停止重连')
            return
        }

        this.clearReconnect()
        this.reconnectAttempts++
        const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
        console.log(`[WS] ${delay}ms 后重连 (第 ${this.reconnectAttempts} 次)`)

        this.reconnectTimer = setTimeout(() => {
            this.connect()
        }, delay)
    }

    private clearReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
    }

    private startHeartbeat() {
        this.stopHeartbeat()
        if (this.options.heartbeatInterval <= 0) return

        this.heartbeatTimer = setInterval(() => {
            if (this.socket && this.state === 'connected') {
                try {
                    this.socket.send({ data: 'ping' })
                } catch (e) {
                    // ignore
                }
            }
        }, this.options.heartbeatInterval)
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = null
        }
    }

    private setState(s: WsConnectionState) {
        if (this.state === s) return
        this.state = s
        this.options.onStateChange(s)
    }
}
