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
import { academicApi } from '@/api/auth-apis'

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
        // 挂机恢复：checkSchoolSession 续上了 webvpn 会话，但 jwxt 子域专属 cookies
        // 不会被 refresh 自动带回来（走不同 host）。fire-and-forget 触发一次教务 init，
        // 让后端拿到 jwxt cookies + 发 AcademicSessionReadyEvent → 爬 acdm-*。
        // 静默：失败不打扰用户（他只是挂机恢复），空频道由 notice 页空态按钮兜底。
        academicApi.initAcademic().catch((e: any) => {
          console.warn('[App] 教务系统静默初始化失败', e?.message)
        })
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

  // WS 重连由 ws.ts watch 自动管理，onShow 只处理后台恢复（断线重连）
  if (userStore.isSchoolLoggedIn && !wsStore.isConnected && !wsStore.isConnecting) {
    wsStore.connect()
  }
})

onHide(() => {
  console.log('[App] 进入后台')
})
</script>

<style lang="scss">
/*
 * ⭐ 锁定 TDesign 浅色主题（见 .claude/CLAUDE.md）
 *
 * main.ts 引入的 tdesign-uniapp/common/style/theme/index.css 里有一段
 * @media (prefers-color-scheme: dark) {...}，会把所有 --td-*-color-* CSS 变量
 * 改成暗色值。华为 EMUI / WeChat 里用户开了"深色模式" → 这个媒体查询命中 →
 * TDesign 组件（尤其 t-input / t-button / t-card）全部变暗。
 *
 * pages.json: darkmode: false 只影响 tabBar/导航栏，管不住 CSS 媒体查询。
 * 我们项目没做完整暗色适配，直接重写同一段媒体查询覆盖掉关键变量，锁死浅色。
 */
@media (prefers-color-scheme: dark) {
  page,
  .page {
    --td-bg-color-page: #f5f5f5 !important;
    --td-bg-color-container: #ffffff !important;
    --td-bg-color-component: #ffffff !important;
    --td-bg-color-component-hover: #f3f3f3 !important;
    --td-bg-color-component-active: #e7e7e7 !important;
    --td-bg-color-component-disabled: #eeeeee !important;
    --td-bg-color-specialcomponent: #ffffff !important;
    --td-bg-color-secondarycontainer: #f3f3f3 !important;
    --td-text-color-primary: #181818 !important;
    --td-text-color-secondary: #333333 !important;
    --td-text-color-placeholder: #bbbbbb !important;
    --td-text-color-disabled: #cccccc !important;
    --td-text-color-anti: #ffffff !important;
    --td-component-border: #e7e7e7 !important;
    --td-component-stroke: #dcdcdc !important;
    --td-border-level-1-color: #e7e7e7 !important;
    --td-border-level-2-color: #e7e7e7 !important;
  }
}

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
