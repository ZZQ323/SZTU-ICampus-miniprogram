<!--
  App.vue（重构版）
  
  全局挂载：
  - AuthMask：认证检查遮罩
  - ErrorOverlay：错误弹窗
-->

<template>
  <!-- 全局认证遮罩 -->
  <AuthMask />

  <!-- 全局错误弹窗 -->
  <ErrorOverlay />
</template>

<script setup lang="ts">
/**
 * 应用入口
 */
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import AuthMask from '@/components/AuthMask.vue'
import ErrorOverlay from '@/components/ErrorOverlay.vue'
import { useUserStore } from '@/store/modules/user'
import { useAuthStore } from '@/store/modules/auth'

const userStore = useUserStore()
const authStore = useAuthStore()

// ==================== 生命周期 ====================

onLaunch(async () => {
  console.log('[App] 应用启动')

  // 初始化 Token（如果本地没有）
  if (!userStore.hasToken) {
    try {
      authStore.setPhase('checking-token', '正在初始化...')
      await userStore.initToken()
      authStore.setPhase('idle')
      console.log('[App] Token 初始化成功')
    } catch (e) {
      console.error('[App] Token 初始化失败', e)
      authStore.setPhase('idle')
      // 不阻塞启动，后续页面会处理
    }
  }
})

onShow(() => {
  console.log('[App] 应用进入前台')
})

onHide(() => {
  console.log('[App] 应用进入后台')
})
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