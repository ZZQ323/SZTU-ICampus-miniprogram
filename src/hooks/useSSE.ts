/**
 * SSE 连接管理 Hook
 * 
 * 文件：src/hooks/useSSE.ts
 * 
 * 功能：
 * 1. 管理与后端的 Server-Sent Events 连接
 * 2. 收到心跳时检查 Token 状态，提前刷新
 * 3. 自动重连机制（带指数退避）
 * 4. 重连前先确保 Token 有效
 */

import { ref, onUnmounted } from 'vue'
import { getToken, setToken } from '@/utils/storage'
import { useUserStore } from '@/store/modules/user'

// ==================== 类型定义 ====================

export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface SSEOptions {
  /** 收到消息的回调 */
  onMessage?: (data: any) => void
  /** 收到心跳的回调 */
  onHeartbeat?: (data: any) => void
  /** 发生错误的回调 */
  onError?: (error: any) => void
  /** 连接成功的回调 */
  onOpen?: () => void
  /** 连接关闭的回调 */
  onClose?: () => void
  /** 自动重连 */
  autoReconnect?: boolean
  /** 基础重连间隔（毫秒） */
  baseReconnectInterval?: number
  /** 最大重连次数 */
  maxReconnects?: number
}

// ==================== 常量 ====================

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.3.35:8080'

/** Token 提前刷新阈值：30 分钟 */
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000

// ==================== Hook ====================

export function useSSE(topic: string, options: SSEOptions = {}) {
  const {
    onMessage,
    onHeartbeat,
    onError,
    onOpen,
    onClose,
    autoReconnect = true,
    baseReconnectInterval = 1000,  // 基础 1 秒
    maxReconnects = 5
  } = options

  // 状态
  const status = ref<SSEStatus>('idle')
  const reconnectCount = ref(0)

  // 内部变量
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // ==================== Token 检查 ====================

  /**
   * 检查 Token 是否需要刷新
   * 
   * @returns 是否需要刷新
   */
  function checkTokenNeedsRefresh(): boolean {
    const token = getToken()
    if (!token) return true

    try {
      const parts = token.split('.')
      if (parts.length !== 3) return true

      const payload = JSON.parse(decodeBase64(parts[1]))
      const exp = payload.exp  // 过期时间（秒）

      if (!exp) return false

      const now = Math.floor(Date.now() / 1000)
      const timeToExpire = (exp - now) * 1000  // 转为毫秒

      // 剩余时间少于阈值，需要刷新
      return timeToExpire < TOKEN_REFRESH_THRESHOLD
    } catch (e) {
      console.warn('[SSE] 检查 Token 失败', e)
      return true
    }
  }

  /**
   * 刷新 Token（如果需要）
   */
  async function refreshTokenIfNeeded(): Promise<boolean> {
    if (!checkTokenNeedsRefresh()) {
      return true
    }

    console.log('[SSE] Token 即将过期或已过期，刷新...')

    try {
      const userStore = useUserStore()
      const success = await userStore.refreshTokenIfNeeded()

      if (success) {
        console.log('[SSE] Token 刷新成功')
        return true
      } else {
        console.warn('[SSE] Token 刷新失败')
        return false
      }
    } catch (e) {
      console.error('[SSE] 刷新 Token 异常', e)
      return false
    }
  }

  /**
   * Base64 解码（兼容小程序）
   */
  function decodeBase64(str: string): string {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64.length % 4
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64

    if (typeof uni !== 'undefined' && uni.base64ToArrayBuffer) {
      try {
        const arrayBuffer = uni.base64ToArrayBuffer(padded)
        const bytes = new Uint8Array(arrayBuffer)
        let result = ''
        for (let i = 0; i < bytes.length; i++) {
          result += String.fromCharCode(bytes[i])
        }
        return decodeURIComponent(escape(result))
      } catch (e) {
        // fallback
      }
    }

    if (typeof atob !== 'undefined') {
      return decodeURIComponent(escape(atob(padded)))
    }

    throw new Error('无法解码 Base64')
  }

  // ==================== 连接方法 ====================

  /**
   * 建立连接
   */
  async function connect() {
    if (status.value === 'connecting' || status.value === 'connected') {
      console.log('[SSE] 已经连接或正在连接中')
      return
    }

    // ⭐ 连接前先确保 Token 有效
    const tokenValid = await refreshTokenIfNeeded()
    if (!tokenValid) {
      console.warn('[SSE] Token 无效，尝试重新初始化')
      try {
        const userStore = useUserStore()
        await userStore.initToken()
      } catch (e) {
        console.error('[SSE] 初始化 Token 失败', e)
        status.value = 'error'
        onError?.(e)
        return
      }
    }

    const token = getToken()
    if (!token) {
      console.warn('[SSE] 无 Token，无法连接')
      status.value = 'error'
      return
    }

    status.value = 'connecting'

    // 构建 URL
    const url = `${BASE_URL}/stream/${topic}?token=${encodeURIComponent(token)}`

    try {
      // 小程序环境使用 uni.request 轮询模拟 SSE
      // H5 环境使用 EventSource
      if (typeof EventSource !== 'undefined') {
        createEventSource(url)
      } else {
        // 小程序环境：使用轮询替代
        console.warn('[SSE] 当前环境不支持 EventSource，使用轮询')
        startPolling()
      }
    } catch (e) {
      console.error('[SSE] 创建连接失败', e)
      status.value = 'error'
      onError?.(e)
    }
  }

  /**
   * 创建 EventSource（H5 环境）
   */
  function createEventSource(url: string) {
    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      console.log('[SSE] 连接成功')
      status.value = 'connected'
      reconnectCount.value = 0  // 重置重连计数
      onOpen?.()
    }

    // 通用消息处理
    eventSource.onmessage = (event) => {
      handleMessage(event.data)
    }

    // ⭐ 监听心跳事件（后端发送 event: HEARTBEAT）
    eventSource.addEventListener('HEARTBEAT', (event: any) => {
      handleHeartbeat(event.data)
    })

    // 监听公告状态事件
    eventSource.addEventListener('ANNOUNCEMENT_STATUS', (event: any) => {
      handleMessage(event.data, 'ANNOUNCEMENT_STATUS')
    })

    // 监听新公告事件
    eventSource.addEventListener('NEW_ANNOUNCEMENTS', (event: any) => {
      handleMessage(event.data, 'NEW_ANNOUNCEMENTS')
    })

    eventSource.onerror = (error) => {
      console.error('[SSE] 连接错误', error)
      status.value = 'error'
      onError?.(error)

      // 关闭当前连接
      eventSource?.close()
      eventSource = null

      // 尝试重连
      if (autoReconnect && reconnectCount.value < maxReconnects) {
        scheduleReconnect()
      } else if (reconnectCount.value >= maxReconnects) {
        console.error('[SSE] 达到最大重连次数，停止重连')
      }
    }
  }

  /**
   * 处理消息
   */
  function handleMessage(rawData: string, eventType?: string) {
    try {
      const data = JSON.parse(rawData)

      // 如果是心跳消息
      if (data.type === 'HEARTBEAT' || eventType === 'HEARTBEAT') {
        handleHeartbeat(rawData)
        return
      }

      onMessage?.({ ...data, _eventType: eventType })
    } catch (e) {
      console.warn('[SSE] 解析消息失败', rawData)
      onMessage?.(rawData)
    }
  }

  /**
   * ⭐ 处理心跳消息
   * 
   * 收到心跳时检查 Token 状态，提前刷新避免过期
   */
  async function handleHeartbeat(rawData: string) {
    console.log('[SSE] 收到心跳')

    try {
      const data = JSON.parse(rawData)
      onHeartbeat?.(data)
    } catch (e) {
      // 忽略解析错误
    }

    // ⭐ 关键：收到心跳时检查 Token 是否需要刷新
    if (checkTokenNeedsRefresh()) {
      console.log('[SSE] 心跳检测到 Token 即将过期，刷新...')
      await refreshTokenIfNeeded()
    }
  }

  /**
   * 轮询模式（小程序环境）
   */
  function startPolling() {
    // TODO: 实现轮询逻辑
    // 可以使用 setInterval + uni.request 定时拉取数据
    console.log('[SSE] 轮询模式暂未实现')
    status.value = 'connected'
  }

  /**
   * ⭐ 安排重连（指数退避）
   */
  function scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    // 指数退避：1s, 2s, 4s, 8s, 16s
    const delay = baseReconnectInterval * Math.pow(2, reconnectCount.value)
    reconnectCount.value++

    console.log(`[SSE] ${delay / 1000}s 后尝试第 ${reconnectCount.value} 次重连`)

    reconnectTimer = setTimeout(async () => {
      // ⭐ 重连前先确保 Token 有效
      await refreshTokenIfNeeded()
      connect()
    }, delay)
  }

  /**
   * 断开连接
   */
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    status.value = 'disconnected'
    onClose?.()
    console.log('[SSE] 连接已断开')
  }

  /**
   * 重置重连计数
   */
  function resetReconnect() {
    reconnectCount.value = 0
  }

  /**
   * 手动重连
   */
  async function reconnect() {
    disconnect()
    reconnectCount.value = 0
    await connect()
  }

  // ==================== 生命周期 ====================

  // 组件卸载时断开连接
  onUnmounted(() => {
    disconnect()
  })

  // ==================== 返回 ====================

  return {
    // 状态
    status,
    reconnectCount,

    // 方法
    connect,
    disconnect,
    reconnect,
    resetReconnect,
  }
}