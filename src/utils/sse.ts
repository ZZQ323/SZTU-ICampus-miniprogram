/**
 * SSE 客户端
 * 
 * 文件路径: src/utils/sse.ts
 */

import type { MessageHandler, ErrorHandler, ConnectionStatus } from '@/types/sse'
import { getToken } from '@/utils/storage'  // 使用项目已有的 token 获取方法

// ==================== 内部类型 ====================

interface ChunkedRequestTask extends UniApp.RequestTask {
  onChunkReceived: (callback: (res: { data: ArrayBuffer }) => void) => void
}

interface ConnectionInfo {
  requestTask: ChunkedRequestTask
  status: ConnectionStatus
  reconnectAttempts: number
}

interface SSEConfig {
  baseUrl: string
  maxReconnectAttempts: number
  reconnectInterval: number
  reconnectBackoffMultiplier: number
}

// ==================== 配置 ====================

const config: SSEConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  maxReconnectAttempts: 5,
  reconnectInterval: 3000,
  reconnectBackoffMultiplier: 1.5
}

// ==================== SSE Client Class ====================

class SSEClient {
  private connections = new Map<string, ConnectionInfo>()
  private handlers = new Map<string, MessageHandler>()
  private errorHandlers = new Map<string, ErrorHandler>()
  private statusCallbacks = new Map<string, (status: ConnectionStatus) => void>()
  
  /** 设置 API 基础路径 */
  setBaseUrl(url: string): void {
    config.baseUrl = url
  }
  
  /** 订阅指定 topic */
  subscribe(
    topic: string,
    onMessage: MessageHandler,
    onError?: ErrorHandler,
    onStatusChange?: (status: ConnectionStatus) => void
  ): void {
    // 使用项目的 getToken 方法
    const token = getToken()
    
    console.log('[SSE] subscribe - token:', token ? `${token.substring(0, 20)}...` : '未获取')
    
    if (!token) {
      console.error('[SSE] Token 未获取到')
      onError?.({ code: 'NO_TOKEN', message: '未登录' })
      return
    }
    
    this.unsubscribe(topic)
    
    this.handlers.set(topic, onMessage)
    if (onError) this.errorHandlers.set(topic, onError)
    if (onStatusChange) this.statusCallbacks.set(topic, onStatusChange)
    
    this.connect(topic, token)
  }
  
  /** 建立连接 */
  private connect(topic: string, token: string, reconnectAttempt = 0): void {
    this.updateStatus(topic, 'connecting')
    
    let buffer = ''
    const url = `${config.baseUrl}/stream/${topic}`
    
    console.log('[SSE] 正在连接:', url)
    
    const requestTask = uni.request({
      url,
      method: 'GET',
      // @ts-ignore - enableChunked 是小程序支持的参数
      enableChunked: true,
      header: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      success: () => {},
      fail: (err) => {
        console.error(`[SSE] 连接失败 [${topic}]:`, err)
        this.handleError(topic, { code: 'CONNECT_FAIL', message: err.errMsg || '连接失败' }, reconnectAttempt)
      },
      complete: () => {
        const connInfo = this.connections.get(topic)
        if (connInfo && connInfo.status !== 'disconnected') {
          this.updateStatus(topic, 'disconnected')
          this.scheduleReconnect(topic, token, reconnectAttempt)
        }
      }
    }) as unknown as ChunkedRequestTask
    
    if (typeof requestTask.onChunkReceived === 'function') {
      requestTask.onChunkReceived((res) => {
        const connInfo = this.connections.get(topic)
        if (connInfo && connInfo.status === 'connecting') {
          this.updateStatus(topic, 'connected')
          connInfo.reconnectAttempts = 0
          console.log('[SSE] 连接成功:', topic)
        }
        
        buffer += this.arrayBufferToString(res.data)
        
        this.parseSSE(buffer).forEach(event => {
          if (event.data) this.handleMessage(topic, event.data, event.event)
        })
        
        const lastIdx = buffer.lastIndexOf('\n\n')
        if (lastIdx !== -1) buffer = buffer.substring(lastIdx + 2)
      })
    } else {
      console.warn('[SSE] 当前环境不支持 onChunkReceived')
      this.handleError(topic, { code: 'NOT_SUPPORTED', message: '当前环境不支持流式传输' }, reconnectAttempt)
      return
    }
    
    this.connections.set(topic, { requestTask, status: 'connecting', reconnectAttempts: reconnectAttempt })
  }
  
  /** 处理消息 */
  private handleMessage(topic: string, data: string, eventType: string): void {
    const handler = this.handlers.get(topic)
    if (!handler) return
    
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.type === 'AUTH_REQUIRED') {
        this.errorHandlers.get(topic)?.({ code: 'AUTH_REQUIRED', message: parsed.message || '请重新登录' })
        return
      }
      
      if (parsed.type === 'HEARTBEAT') return
      
      handler(parsed.data || parsed, eventType)
    } catch {
      handler(data, eventType)
    }
  }
  
  /** 处理错误 */
  private handleError(topic: string, error: { code: string; message: string }, reconnectAttempt: number): void {
    this.updateStatus(topic, 'error')
    this.errorHandlers.get(topic)?.(error)
    
    if (error.code !== 'NOT_SUPPORTED') {
      const token = getToken()
      if (token) this.scheduleReconnect(topic, token, reconnectAttempt)
    }
  }
  
  /** 计划重连 */
  private scheduleReconnect(topic: string, token: string, currentAttempt: number): void {
    if (currentAttempt >= config.maxReconnectAttempts) {
      this.errorHandlers.get(topic)?.({ code: 'MAX_RECONNECT', message: '连接失败，请检查网络后重试' })
      return
    }
    
    const delay = config.reconnectInterval * Math.pow(config.reconnectBackoffMultiplier, currentAttempt)
    console.log(`[SSE] ${delay}ms 后重连 [${topic}], 第 ${currentAttempt + 1} 次`)
    
    setTimeout(() => {
      const connInfo = this.connections.get(topic)
      if (connInfo && connInfo.status !== 'disconnected') {
        this.connect(topic, token, currentAttempt + 1)
      }
    }, delay)
  }
  
  /** 取消订阅 */
  unsubscribe(topic: string): void {
    const connInfo = this.connections.get(topic)
    if (connInfo) {
      connInfo.status = 'disconnected'
      try { connInfo.requestTask.abort() } catch {}
      this.connections.delete(topic)
    }
    this.handlers.delete(topic)
    this.errorHandlers.delete(topic)
    this.statusCallbacks.delete(topic)
  }
  
  /** 取消所有订阅 */
  unsubscribeAll(): void {
    for (const topic of this.connections.keys()) {
      this.unsubscribe(topic)
    }
  }
  
  /** 获取连接状态 */
  getStatus(topic: string): ConnectionStatus {
    return this.connections.get(topic)?.status || 'disconnected'
  }
  
  private updateStatus(topic: string, status: ConnectionStatus): void {
    const connInfo = this.connections.get(topic)
    if (connInfo) connInfo.status = status
    this.statusCallbacks.get(topic)?.(status)
  }
  
  private parseSSE(text: string): Array<{ event: string; data: string | null }> {
    return text.split('\n\n').filter(b => b.trim()).map(block => {
      const event = { event: 'message', data: null as string | null }
      block.split('\n').forEach(line => {
        if (line.startsWith('event:')) event.event = line.substring(6).trim()
        else if (line.startsWith('data:')) event.data = line.substring(5).trim()
      })
      return event
    }).filter(e => e.data !== null)
  }
  
  private arrayBufferToString(buffer: ArrayBuffer): string {
    return typeof TextDecoder !== 'undefined'
      ? new TextDecoder('utf-8').decode(buffer)
      : Array.from(new Uint8Array(buffer)).map(b => String.fromCharCode(b)).join('')
  }
}

// ==================== 导出单例 ====================

export const sseClient = new SSEClient()
export default sseClient
