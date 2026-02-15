/**
 * 路由守卫
 *
 * uniapp 没有 vue-router 的 beforeEach，但可以用 uni.addInterceptor 拦截跳转
 *
 * 工作原理：
 * 每次调用 uni.navigateTo / uni.redirectTo / uni.reLaunch 时，
 * 都会先经过这里的 invoke 函数，在里面判断有没有 token
 */
import { getToken } from './storage'

const LOGIN_PAGE = '/pages/login/index'

// 需要登录的页面列表（你可以在这里加）
const NEED_LOGIN: string[] = [
  '/pages/schedule/index',
  // '/pages/profile/index',
  // '/pages/subscription/index',
]

// 不拦截的页面（白名单）
const WHITE_LIST: string[] = [
  '/pages/home/index',
  '/pages/login/index',
]

export function setupRouterGuard() {
  // 拦截三种跳转方式
  const methods = ['navigateTo', 'redirectTo', 'reLaunch'] as const

  methods.forEach((method) => {
    uni.addInterceptor(method, {
      invoke(args: { url: string }) {
        const path = args.url.split('?')[0]

        // 白名单直接放行
        if (WHITE_LIST.includes(path)) return true

        // 需要登录的页面，检查 token
        if (NEED_LOGIN.includes(path) && !getToken()) {
          uni.showToast({ title: '请先登录', icon: 'none' })
          setTimeout(() => {
            uni.navigateTo({
              url: `${LOGIN_PAGE}?redirect=${encodeURIComponent(args.url)}`,
            })
          }, 300)
          return false  // 阻止原始跳转
        }

        return true
      },
    })
  })
}

/**
 * TabBar 页面的权限检查
 *
 * ⚠️ 重要：switchTab 不能被 addInterceptor 拦截
 * 所以在需要登录的 TabBar 页面的 onShow 中调用这个函数
 *
 * 使用方式：
 *   import { checkTabAuth } from '@/utils/router'
 *   onShow(() => { checkTabAuth() })
 */
export function checkTabAuth(): boolean {
  if (!getToken()) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.navigateTo({ url: LOGIN_PAGE })
    }, 300)
    return false
  }
  return true
}
