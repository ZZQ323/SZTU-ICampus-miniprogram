/**
 * SSE 连接管理 Hook
 * 
 * 文件路径: src/hooks/useSSE.ts
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { sseClient } from '@/utils/sse'
import type { ConnectionStatus, MessageHandler, ErrorHandler } from '@/types/sse'

interface UseSSEOptions {
  /** 是否在挂载时自动连接 */
  autoConnect?: boolean
  /** 消息处理器 */
  onMessage?: MessageHandler
  /** 错误处理器 */
  onError?: ErrorHandler
}

export function useSSE(topic: string, options: UseSSEOptions = {}) 
{
  const { autoConnect = true, onMessage, onError } = options
  
  // ==================== 状态 ====================
  
  const status = ref<ConnectionStatus>('disconnected')
  const error = ref<{ code: string; message: string } | null>(null)
  const showAuthDialog = ref(false)
  const authMessage = ref('')
  
  // ==================== 方法 ====================
  
  /** 连接 SSE */
  function connect(messageHandler?: MessageHandler, errorHandler?: ErrorHandler) 
  {
    const msgHandler = messageHandler || onMessage || (() => {})
    const errHandler = errorHandler || onError || defaultErrorHandler
    
    sseClient.subscribe(
      topic,
      msgHandler,
      errHandler,
      (newStatus) => {
        status.value = newStatus
      }
    )
  }
  
  /** 断开连接 */
  function disconnect() {
    sseClient.unsubscribe(topic)
    status.value = 'disconnected'
  }
  
  /** 重新连接 */
  function reconnect() {
    disconnect()
    connect()
  }
  
  /** 默认错误处理 */
  function defaultErrorHandler(err: { code: string; message: string }) {
    console.error(`[SSE] 错误 [${topic}]:`, err)
    error.value = err
    
    if (err.code === 'AUTH_REQUIRED') {
      showAuthDialog.value = true
      authMessage.value = err.message
    } else if (err.code === 'MAX_RECONNECT') {
      uni.showToast({ title: err.message, icon: 'none' })
    } else if (err.code === 'NO_TOKEN') {
      showAuthDialog.value = true
      authMessage.value = '请先登录'
    }
  }
  
  /** 关闭认证弹窗并跳转登录 */
  function goToLogin() {
    showAuthDialog.value = false
    uni.navigateTo({ url: '/pages/common/login/index' })
  }
  
  /** 关闭认证弹窗 */
  function closeAuthDialog() {
    showAuthDialog.value = false
  }
  
  // ==================== 生命周期 ====================
  
  onMounted(() => {
    if (autoConnect) {
      connect()
    }
  })
  
  onUnmounted(() => {
    disconnect()
  })
  
  // ==================== 导出 ====================
  
  return {
    // 状态
    status,
    error,
    showAuthDialog,
    authMessage,
    
    // 方法
    connect,
    disconnect,
    reconnect,
    goToLogin,
    closeAuthDialog
  }
}
