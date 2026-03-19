import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
// import { setupRouterGuard } from '@/utils/router'
import 'tdesign-uniapp/common/style/theme/index.css';

export function createApp() {
  const app = createSSRApp(App)

  // 注册 Pinia 状态管理
  const pinia = createPinia()
  pinia.use(piniaPersistedstate)  // 让 store 数据能持久化到本地
  app.use(pinia)

  // 初始化路由守卫（拦截需要登录的页面）
  // setupRouterGuard()

  return { app }
}
