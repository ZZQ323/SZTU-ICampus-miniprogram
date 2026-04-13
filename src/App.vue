<!--
  App.vue（Cookie 直通版）
  职责：
  1. 启动时检查本地 cookies → 初始化 info store
  2. 切回前台时确保 WS 连接
  3. 不再管 token
-->

<template>
  <!-- 小程序为多页应用，就不要想这里的事情了吧啊哈哈哈哈哈 -->
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'
import { useWsStore } from '@/store/modules/ws'
import { useInfoStore } from '@/store/modules/info'
import { hasAuth } from '@/utils/cookie-manager'

const userStore = useUserStore()
const wsStore = useWsStore()
const infoStore = useInfoStore()

// ==================== 生命周期 ====================

onLaunch(async () => {
  console.log('[App] 应用启动')

  // 有本地 cookies → 先验证 session，再加载数据
  if (hasAuth()) {
    try {
      const status = await userStore.checkSchoolSession()
      if (status.logined) {
        infoStore.init()
      }
      // 未登录：不加载数据，等用户操作
    } catch (e) {
      console.warn('[App] 启动验证失败', e)
      // 网络错误：保留离线状态，不清除
    }
  }
})

onShow(() => {
  console.log('[App] 进入前台')

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
