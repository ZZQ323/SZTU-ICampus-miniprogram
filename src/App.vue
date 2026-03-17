<!--
  App.vue（保活版 - 使用 useAuth hook）
  
  功能：
  1. 全局 30 分钟保活定时器
  2. onShow 时 **强制检查 Token 有效性**（不仅仅检查时间间隔）
  3. onHide 时停止定时器
  
  ⚠️ 核心改动：
  - onShow 先检查 Token 是否过期，过期则先刷新
  - 防止 Token 过期后多个请求同时收到 401 造成请求风暴
  
  ⚠️ 注意：小程序不是 SPA，App.vue 中的组件不会出现在子页面
  遮罩和错误弹窗通过 PageLayout 组件在每个页面内挂载
-->

<template>
  <!-- 小程序 App.vue 不渲染任何内容 -->
</template>

<script setup lang="ts">
/**
 * 应用入口（保活版）
 */
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'
import { useAuth, KEEP_ALIVE_INTERVAL } from '@/hooks/useAuth'

const userStore = useUserStore()
const { checkStatus, needsRefresh } = useAuth()

// ==================== 保活配置 ====================

/** 保活定时器 */
let keepAliveTimer: ReturnType<typeof setInterval> | null = null

/** 标记是否正在检查中，防止并发 */
let isChecking = false

// ==================== 生命周期 ====================

onLaunch(async () => {
  console.log('[App] 应用启动')

  // 1. 初始化 Token（如果本地没有）
  if (!userStore.hasToken) {
    try {
      await userStore.initToken()
      console.log('[App] Token 初始化成功')
    } catch (e) {
      console.error('[App] Token 初始化失败', e)
      // 不阻塞启动，后续页面会处理
    }
  }

  // 2. 启动时检查一次状态（静默）
  await performCheck()

  // 3. 启动保活定时器
  startKeepAliveTimer()
})

onShow(async () => {
  console.log('[App] 应用进入前台')

  // ⭐ 关键：每次回到前台都强制检查 Token 状态
  // 即使距离上次检查不到 30 分钟，也要检查 Token 是否过期
  await performCheck()

  // 恢复保活定时器
  startKeepAliveTimer()
})

onHide(() => {
  console.log('[App] 应用进入后台')

  // 停止保活定时器
  stopKeepAliveTimer()
})

// ==================== 核心检查逻辑 ====================

/**
 * 执行检查（带并发保护）
 * 
 * 检查顺序：
 * 1. Token 是否存在 → 不存在则 initToken
 * 2. Token 是否过期 → 过期则 refreshToken
 * 3. 调用 checkStatus 刷新 Cookie/登录状态（如果距上次超过 30 分钟）
 */
async function performCheck() {
  // 防止并发检查
  if (isChecking) {
    console.log('[App] 已有检查进行中，跳过')
    return
  }

  isChecking = true

  try {
    // 1. 检查是否有 Token
    if (!userStore.hasToken) {
      console.log('[App] 无 Token，进行初始化')
      await userStore.initToken()
    }

    // 2. ⭐ 检查 Token 是否即将过期或已过期
    const tokenStatus = checkTokenStatus()

    if (tokenStatus === 'expired') {
      console.log('[App] Token 已过期，刷新 Token')
      const refreshed = await userStore.refreshTokenIfNeeded()
      if (!refreshed) {
        console.warn('[App] Token 刷新失败，重新初始化')
        await userStore.initToken()
      }
    } else if (tokenStatus === 'expiring_soon') {
      console.log('[App] Token 即将过期（<30分钟），提前刷新')
      await userStore.refreshTokenIfNeeded()
    } else {
      console.log('[App] Token 状态正常')
    }

    // 3. Token 有效后，检查 Cookie/登录状态
    // 只有距离上次检查超过阈值才检查，避免频繁请求
    if (needsRefresh()) {
      console.log('[App] 距上次检查超过 30 分钟，检查登录状态')
      await checkStatus()
    } else {
      console.log('[App] 距上次检查未超过 30 分钟，跳过状态检查')
    }
  } catch (e) {
    console.error('[App] 检查失败', e)
    // 检查失败不阻塞应用，后续页面会处理
  } finally {
    isChecking = false
  }
}

/**
 * 检查 Token 状态
 * 
 * 通过解析 JWT 的 exp 字段判断过期时间
 * 
 * @returns 'valid' | 'expiring_soon' | 'expired' | 'no_token'
 */
function checkTokenStatus(): 'valid' | 'expiring_soon' | 'expired' | 'no_token' {
  const tokenValue = userStore.token
  if (!tokenValue) {
    return 'no_token'
  }

  try {
    // 解析 JWT payload（第二段）
    const parts = tokenValue.split('.')
    if (parts.length !== 3) {
      console.warn('[App] Token 格式无效')
      return 'expired'
    }

    // Base64 解码
    const payload = JSON.parse(decodeBase64(parts[1]))
    const exp = payload.exp  // 过期时间（秒）

    if (!exp) {
      console.warn('[App] Token 无过期时间字段')
      return 'valid'  // 没有过期时间，假设有效
    }

    const now = Math.floor(Date.now() / 1000)  // 当前时间（秒）
    const timeToExpire = exp - now  // 剩余时间（秒）

    console.log(`[App] Token 剩余时间: ${Math.floor(timeToExpire / 60)} 分钟`)

    if (timeToExpire <= 0) {
      return 'expired'
    }

    // 剩余时间少于 30 分钟，认为即将过期
    if (timeToExpire < 30 * 60) {
      return 'expiring_soon'
    }

    return 'valid'
  } catch (e) {
    console.error('[App] 解析 Token 失败', e)
    return 'expired'  // 解析失败，认为过期
  }
}

/**
 * Base64 解码（兼容小程序和 H5）
 */
function decodeBase64(str: string): string {
  // 处理 URL 安全的 Base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')

  // 补齐 padding
  const pad = base64.length % 4
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64

  // 小程序环境
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
      // fallback to atob
    }
  }

  // H5 环境
  if (typeof atob !== 'undefined') {
    return decodeURIComponent(escape(atob(padded)))
  }

  throw new Error('无法解码 Base64')
}

// ==================== 保活定时器 ====================

/**
 * 启动保活定时器
 */
function startKeepAliveTimer() {
  if (keepAliveTimer) {
    console.log('[App] 保活定时器已存在，跳过')
    return
  }

  keepAliveTimer = setInterval(() => {
    console.log('[App] 保活定时器触发')
    performCheck()
  }, KEEP_ALIVE_INTERVAL)

  console.log('[App] 保活定时器已启动，间隔 30 分钟')
}

/**
 * 停止保活定时器
 */
function stopKeepAliveTimer() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
    console.log('[App] 保活定时器已停止')
  }
}
</script>

<style lang="scss">
/* 全局样式 */

/* 重置样式 */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

/* 安全区域适配 */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

/* 通用工具类 */
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

/* 文本省略 */
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

/* 隐藏滚动条 */
::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>