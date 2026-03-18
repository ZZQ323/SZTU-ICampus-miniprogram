<!--
  App.vue（WebSocket 版）
  
  功能：
  1. 全局 30 分钟保活定时器
  2. onShow 时检查 Token 有效性
  3. ★ 登录后自动建立 WebSocket 连接
  4. ★ 进入后台断开 WS，回到前台重连
  
  ⚠️ 改动点（SSE → WS）：
  - 新增 useWsStore 导入
  - onShow 中 Token 检查通过后调 wsStore.connect()
  - onHide 中不断开 WS（WS 原生 ping/pong 保活，比 SSE 省资源）
-->

<template>
  <!-- 小程序 App.vue 不渲染任何内容 -->
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'
import { useWsStore } from '@/store/modules/ws'
import { useInfoStore } from '@/store/modules/info'
import { useAuth, KEEP_ALIVE_INTERVAL } from '@/hooks/useAuth'

const userStore = useUserStore()
const wsStore = useWsStore()
const infoStore = useInfoStore()
const { checkStatus, needsRefresh } = useAuth()

// ==================== 保活配置 ====================

let keepAliveTimer: ReturnType<typeof setInterval> | null = null
let isChecking = false

// ==================== 生命周期 ====================

onLaunch(async () => {
  console.log('[App] 应用启动')

  // 1. 初始化 Token
  if (!userStore.hasToken) {
    try {
      await userStore.initToken()
      console.log('[App] Token 初始化成功')
    } catch (e) {
      console.error('[App] Token 初始化失败', e)
    }
  }

  // 2. 启动时检查一次状态
  await performCheck()

  // 3. 启动保活定时器
  startKeepAliveTimer()

  // 4. ★ 初始化信息流
  infoStore.init()
})

onShow(async () => {
  console.log('[App] 应用进入前台')

  // 检查 Token 状态
  await performCheck()

  // 恢复保活定时器
  startKeepAliveTimer()

  // ★ 回到前台时，如果已登录就确保 WS 连接
  if (userStore.isSchoolLoggedIn) {
    wsStore.connect()
  }
})

onHide(() => {
  console.log('[App] 应用进入后台')
  stopKeepAliveTimer()

  // WS 不主动断开：小程序后台有 5 秒存活期
  // 如果超时被系统回收，下次 onShow 会重连
})

// ==================== 核心检查逻辑 ====================

async function performCheck() {
  if (isChecking) return
  isChecking = true

  try {
    if (!userStore.hasToken) {
      await userStore.initToken()
    }

    const tokenStatus = checkTokenStatus()

    if (tokenStatus === 'expired') {
      const refreshed = await userStore.refreshTokenIfNeeded()
      if (!refreshed) {
        await userStore.initToken()
      }
    } else if (tokenStatus === 'expiring_soon') {
      await userStore.refreshTokenIfNeeded()
    }

    if (needsRefresh()) {
      await checkStatus()
    }
  } catch (e) {
    console.error('[App] 检查失败', e)
  } finally {
    isChecking = false
  }
}

function checkTokenStatus(): 'valid' | 'expiring_soon' | 'expired' | 'no_token' {
  const tokenValue = userStore.token
  if (!tokenValue) return 'no_token'

  try {
    const parts = tokenValue.split('.')
    if (parts.length !== 3) return 'expired'

    const payload = JSON.parse(decodeBase64(parts[1]))
    const exp = payload.exp

    if (!exp) return 'valid'

    const now = Math.floor(Date.now() / 1000)
    const timeToExpire = exp - now

    console.log(`[App] Token 剩余时间: ${Math.floor(timeToExpire / 60)} 分钟`)

    if (timeToExpire <= 0) return 'expired'
    if (timeToExpire < 30 * 60) return 'expiring_soon'
    return 'valid'
  } catch (e) {
    return 'expired'
  }
}

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

// ==================== 保活定时器 ====================

function startKeepAliveTimer() {
  if (keepAliveTimer) return

  keepAliveTimer = setInterval(() => {
    performCheck()
  }, KEEP_ALIVE_INTERVAL)
}

function stopKeepAliveTimer() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}
</script>

<style lang="scss">
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.flex {
  display: flex;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex-column {
  display: flex;
  flex-direction: column;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ellipsis-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>