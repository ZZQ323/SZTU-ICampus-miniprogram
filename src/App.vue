<!--
  App.vue（保活版 - 使用 useAuth hook）
  
  功能：
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
 * 
 * ⭐ 使用 useAuth hook 复用检查逻辑
 */
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'
import { useAuth, KEEP_ALIVE_INTERVAL } from '@/hooks/useAuth'

const userStore = useUserStore()
const { checkStatus, needsRefresh } = useAuth()

// ==================== 保活配置 ====================

/** 保活定时器 */
let keepAliveTimer: ReturnType<typeof setInterval> | null = null

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
  await checkStatus()

  // 3. 启动保活定时器
  startKeepAliveTimer()
})

onShow(() => {
  console.log('[App] 应用进入前台')

  // 检查是否超过保活间隔
  if (needsRefresh()) {
    console.log('[App] 距上次检查超过 30 分钟，立即检查')
    checkStatus()
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
    checkStatus()
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