<!--
  App.vue（三层分治版）

  职责：
  1. 启动时 ensureToken
  2. 切回前台时 ensureToken + WS 重连
  3. 不再自己管 token 刷新 / JWT 解析 / 保活定时器
-->

<template>
  <!-- 小程序为多页应用，就不要想这里的事情了吧啊哈哈哈哈哈 -->
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'
import { useWsStore } from '@/store/modules/ws'
import { useInfoStore } from '@/store/modules/info'
import { ensureToken } from '@/utils/token-manager'

const userStore = useUserStore()
const wsStore = useWsStore()
const infoStore = useInfoStore()

// ==================== 生命周期 ====================

onLaunch(async () => {
  console.log('[App] 应用启动')

  // 确保 token（内部自动判断：无→init，>4h→后台续签，<4h→跳过）
  await ensureToken()

  // 初始化信息流未读数（有 token 才请求，无 token 自动跳过）
  infoStore.init()
})

onShow(() => {
  console.log('[App] 进入前台')

  // 切回前台检查 token（>4h 后台续签，不阻塞）
  ensureToken()

  // 已登录则确保 WS 连接
  if (userStore.isSchoolLoggedIn) {
    wsStore.connect()
  }
})

onHide(() => {
  console.log('[App] 进入后台')
})
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