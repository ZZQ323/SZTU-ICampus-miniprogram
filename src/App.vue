<!--
  App.vue（保活版）
  
  新增功能：
  1. 全局 30 分钟保活定时器
  2. onShow 时检查是否超过 30 分钟未检查
  3. onHide 时停止定时器
  
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
import { useAuthStore } from '@/store/modules/auth'

const userStore = useUserStore()
const authStore = useAuthStore()

// ==================== 保活配置 ====================

/** 保活间隔：30 分钟（毫秒） */
const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000

/** 保活定时器 */
let keepAliveTimer: ReturnType<typeof setInterval> | null = null

/** 上次检查时间 */
let lastCheckTime = 0

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
  await checkStatusSilent()

  // 3. 启动保活定时器
  startKeepAliveTimer()
})

onShow(() => {
  console.log('[App] 应用进入前台')

  // 检查是否超过保活间隔
  const elapsed = Date.now() - lastCheckTime
  if (elapsed > KEEP_ALIVE_INTERVAL) {
    console.log('[App] 距上次检查超过 30 分钟，立即检查')
    checkStatusSilent()
  }

  // 恢复保活定时器
  startKeepAliveTimer()
})

onHide(() => {
  console.log('[App] 应用进入后台')

  // 停止保活定时器
  stopKeepAliveTimer()
})

// ==================== 保活逻辑 ====================

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
    checkStatusSilent()
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

/**
 * 静默检查状态
 * 
 * 调用 /auth/v1/status 接口：
 * - 刷新学校 Cookie（通过重定向保活）
 * - 更新本地登录状态
 * - 触发 Token 续签（通过 AccessTouchInterceptor）
 */
async function checkStatusSilent() {
  // 更新检查时间
  lastCheckTime = Date.now()

  // 如果没有 Token，不检查（会在具体页面处理）
  if (!userStore.hasToken) {
    console.log('[App] 无 Token，跳过状态检查')
    return
  }

  try {
    console.log('[App] 开始静默检查状态...')
    const status = await userStore.checkSchoolSession()
    console.log('[App] 状态检查完成: logined=', status.logined)
  } catch (e: any) {
    console.warn('[App] 状态检查失败:', e?.message || e)

    // 如果是 401，尝试刷新 Token
    if (e?.code === 401) {
      try {
        await userStore.refreshTokenIfNeeded()
        console.log('[App] Token 刷新成功，重试状态检查')
        await userStore.checkSchoolSession()
      } catch (refreshError) {
        console.error('[App] Token 刷新失败:', refreshError)
        // 不阻塞，后续页面会处理
      }
    }

    // 如果是 403，表示 Cookie 过期，后续页面会处理
    if (e?.code === 403) {
      console.log('[App] Cookie 已过期，后续页面会处理')
    }
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