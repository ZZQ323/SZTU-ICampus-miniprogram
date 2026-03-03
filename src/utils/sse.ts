/**
 * SSE 客户端
 * 
 * 文件：src/utils/sse.ts
 */

import { getToken } from './storage'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

type MessageHandler = (data: any) => void

interface SseConnection {
  task: UniApp.RequestTask | null
  handler: MessageHandler
  buffer: string
}

class SseClient {
  private connections: Map<string, SseConnection> = new Map()

  /**
   * 订阅 SSE 流
   */
  subscribe(topic: string, onMessage: MessageHandler): void {
    // 如果已存在，先取消
    if (this.connections.has(topic)) {
      this.unsubscribe(topic)
    }

    const token = getToken()
    if (!token) {
      console.warn('[SSE] 无 Token，无法订阅')
      return
    }

    const url = `${BASE_URL}/stream/${topic}`
    console.log('[SSE] 正在连接:', url)

    const connection: SseConnection = {
      task: null,
      handler: onMessage,
      buffer: ''
    }

    // 使用 uni.request 实现 SSE（小程序不支持 EventSource）
    const task = uni.request({
      url,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      enableChunked: true, // 启用分块传输
      success: () => {
        console.log('[SSE] 连接关闭:', topic)
      },
      fail: (err) => {
        console.error('[SSE] 连接失败:', topic, err)
      }
    })

    // 监听数据块
    task.onChunkReceived?.((res) => {
      try {
        // 解码数据
        const text = this.decodeChunk(res.data)
        connection.buffer += text
        
        // 解析 SSE 事件
        this.parseEvents(connection)
      } catch (e) {
        console.error('[SSE] 解析数据失败:', e)
      }
    })

    connection.task = task
    this.connections.set(topic, connection)
  }

  /**
   * 取消订阅
   */
  unsubscribe(topic: string): void {
    const connection = this.connections.get(topic)
    if (connection) {
      connection.task?.abort()
      this.connections.delete(topic)
      console.log('[SSE] 已取消订阅:', topic)
    }
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void {
    for (const topic of this.connections.keys()) {
      this.unsubscribe(topic)
    }
  }

  /**
   * 解码数据块
   */
  private decodeChunk(data: ArrayBuffer): string {
    // @ts-ignore
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(data)
  }

  /**
   * 解析 SSE 事件
   */
  private parseEvents(connection: SseConnection): void {
    const lines = connection.buffer.split('\n')
    
    let eventType = ''
    let eventData = ''
    
    const processedLines: string[] = []
    
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        eventData = line.slice(5).trim()
      } else if (line === '') {
        // 空行表示事件结束
        if (eventData) {
          try {
            const data = JSON.parse(eventData)
            connection.handler({
              type: eventType || data.type,
              data: data.data || data,
              timestamp: data.timestamp
            })
          } catch (e) {
            // 非 JSON 数据
            connection.handler({
              type: eventType,
              data: eventData
            })
          }
        }
        eventType = ''
        eventData = ''
      } else {
        // 未完成的行，保留到 buffer
        processedLines.push(line)
      }
    }
    
    // 更新 buffer 为未处理完的内容
    connection.buffer = processedLines.join('\n')
  }
}

export const sseClient = new SseClient()