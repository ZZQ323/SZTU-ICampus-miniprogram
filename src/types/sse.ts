/**
 * SSE 相关类型定义
 * 
 * 文件路径: src/types/sse.ts
 */

/** SSE 消息结构 */
export interface SseMessage<T = any> {
  type: string
  data: T
  timestamp: number
  targetUser?: string
  message?: string
}

/** 消息处理回调 */
export type MessageHandler = (data: any, eventType: string) => void

/** 错误处理回调 */
export type ErrorHandler = (error: { code: string; message: string }) => void

/** 连接状态 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
