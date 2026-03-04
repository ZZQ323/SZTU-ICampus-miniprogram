/**
 * 路由守卫工具
 * 
 * 文件：src/utils/router.ts
 */

import { useUserStore } from '@/store/modules/user'

/** 需要登录学校的页面 */
const AUTH_PAGES = [
  '/pages/schedule/schedule',
  '/pages/notice/notice',
]

/** 公开页面（无需任何认证） */
const PUBLIC_PAGES = [
  '/pages/common/login/login',
]

/**
 * 设置路由守卫
 * 
 * 在 main.ts 中调用，拦截页面跳转
 * 
 * 注意：uni-app 的路由拦截能力有限，主要靠页面内 onShow 检查
 * 这里只做简单的拦截，复杂逻辑在页面内用 useAuth hook 处理
 */
export function setupRouterGuard() {
  // 拦截 uni.navigateTo
  const originalNavigateTo = uni.navigateTo
  uni.navigateTo = function (options: UniApp.NavigateToOptions) {
    const url = options.url || ''
    const path = url.split('?')[0]
    
    // 需要认证的页面，检查 token
    if (AUTH_PAGES.some(p => path.startsWith(p))) {
      const userStore = useUserStore()
      if (!userStore.hasToken) {
        // 无 token，跳转到 loading 页初始化
        return originalNavigateTo({
          url: encodeURIComponent("/pages/common/loading/index?redirect="+url+`&type=navigateTo`)
        })
      }
    }
    
    return originalNavigateTo(options)
  } as typeof uni.navigateTo

  // 拦截 uni.switchTab
  const originalSwitchTab = uni.switchTab
  uni.switchTab = function (options: UniApp.SwitchTabOptions) {
    const url = options.url || ''
    const path = url.split('?')[0]
    
    // 需要认证的 Tab 页面，检查 token
    if (AUTH_PAGES.some(p => path.startsWith(p))) {
      const userStore = useUserStore()
      if (!userStore.hasToken) {
        // 无 token，跳转到 loading 页初始化
        return originalNavigateTo({
          url: encodeURIComponent(`/pages/common/loading/index?redirect=`+url+`&type=switchTab`)
        })
      }
    }
    
    return originalSwitchTab(options)
  } as typeof uni.switchTab

  // 拦截 uni.reLaunch
  const originalReLaunch = uni.reLaunch
  uni.reLaunch = function (options: UniApp.ReLaunchOptions) {
    const url = options.url || ''
    const path = url.split('?')[0]
    
    if (AUTH_PAGES.some(p => path.startsWith(p))) {
      const userStore = useUserStore()
      if (!userStore.hasToken) {
        return originalNavigateTo({
          url: encodeURIComponent(`/pages/common/loading/index?redirect=`+url+`&type=reLaunch`)
        })
      }
    }
    
    return originalReLaunch(options)
  } as typeof uni.reLaunch

  console.log('[Router] 路由守卫已初始化')
}

/**
 * 检查 Tab 页面的认证
 * 
 * 在 onShow 中调用，用于 TabBar 页面
 */
export async function checkTabAuth() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const path = '/' + currentPage.route

  // 公开页面直接放行
  if (PUBLIC_PAGES.some(p => path.startsWith(p))) {
    return true
  }

  // 需要认证的页面
  if (AUTH_PAGES.some(p => path.startsWith(p))) {
    const userStore = useUserStore()
    
    // 检查 token
    if (!userStore.hasToken) {
      await initTokenOrRedirect()
      return false
    }

    // 检查学校登录状态
    try {
      const status = await userStore.checkSchoolSession()
      if (!status.logined) {
        uni.navigateTo({ url: '/pages/common/login/login' })
        return false
      }
    } catch (e) {
      console.error('检查登录状态失败', e)
      uni.navigateTo({ url: '/pages/common/login/login' })
      return false
    }
  }

  return true
}

/**
 * 初始化 token 或跳转
 */
async function initTokenOrRedirect() {
  const userStore = useUserStore()
  
  try {
    await userStore.initToken()
    // token 获取成功，继续检查学校登录
    const status = await userStore.checkSchoolSession()
    if (!status.logined) {
      uni.navigateTo({ url: '/pages/common/login/login' })
    }
  } catch (e) {
    console.error('初始化 token 失败', e)
    uni.showToast({ title: '初始化失败', icon: 'error' })
  }
}

/**
 * 跳转到登录页
 */
export function navigateToLogin() {
  uni.navigateTo({ url: '/pages/common/login/login' })
}

/**
 * 跳转到首页
 */
export function navigateToHome() {
  uni.switchTab({ url: '/pages/home/index' })
}

/**
 * 返回上一页，如果没有上一页则跳转首页
 */
export function navigateBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    navigateToHome()
  }
}