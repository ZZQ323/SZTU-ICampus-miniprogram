/**
 * WebSocket 相关类型定义
 *
 * 文件路径: src/types/ws.ts
 *
 * 替代原 types/sse.ts
 * 注意：WsMessage 和 WsConnectionState 的主类型定义在 utils/websocket.ts 中，
 * 这里重新 export 方便其他文件 import。
 */

export type { WsMessage, WsConnectionState } from '@/utils/websocket'

/** 消息处理回调 */
export type MessageHandler = (data: any, eventType: string) => void

/** 错误处理回调 */
export type ErrorHandler = (error: { code: string; message: string }) => void