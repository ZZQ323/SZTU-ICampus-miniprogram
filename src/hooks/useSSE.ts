/**
 * SSE 连接管理 Hook
 * 
 * 文件：src/hooks/useSSE.ts
 * 
 * 用于管理与后端的 Server-Sent Events 连接
 */

import { ref, onUnmounted } from 'vue'
import { getToken } from '@/utils/storage'

// ==================== 类型定义 ====================

export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface SSEOptions {
  /** 收到消息的回调 */
  onMessage?: (data: any) => void
  /** 发生错误的回调 */
  onError?: (error: any) => void
  /** 连接成功的回调 */
  onOpen?: () => void
  /** 连接关闭的回调 */
  onClose?: () => void
  /** 自动重连 */
  autoReconnect?: boolean
  /** 重连间隔（毫秒） */
  reconnectInterval?: number
  /** 最大重连次数 */
  maxReconnects?: number
}

// ==================== 常量 ====================

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.3.35:8080'

// ==================== Hook ====================

export function useSSE(topic: string, options: SSEOptions = {}) {
  const {
    onMessage,
    onError,
    onOpen,
    onClose,
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnects = 3
  } = options

  // 状态
  const status = ref<SSEStatus>('idle')
  const reconnectCount = ref(0)

  // 内部变量
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // ==================== 方法 ====================

  /**
   * 建立连接
   */
  function connect() {
    if (status.value === 'connecting' || status.value === 'connected') {
      console.log('[SSE] 已经连接或正在连接中')
      return
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
      // 这里先用 EventSource（H5 环境）
      if (typeof EventSource !== 'undefined') {
        createEventSource(url)
      } else {
        // 小程序环境：使用轮询或 WebSocket 替代
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
      reconnectCount.value = 0
      onOpen?.()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch (e) {
        console.warn('[SSE] 解析消息失败', event.data)
        onMessage?.(event.data)
      }
    }

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
      }
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
   * 安排重连
   */
  function scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }

    reconnectCount.value++
    console.log(`[SSE] ${reconnectInterval / 1000}s 后尝试第 ${reconnectCount.value} 次重连`)

    reconnectTimer = setTimeout(() => {
      connect()
    }, reconnectInterval)
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
    resetReconnect,
  }
}