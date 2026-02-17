/**
 * 导航工具函数
 * 封装 loading 页面重定向逻辑
 */

export interface LoadingNavOptions {
    /** 目标页面路径 */
    redirect: string
    /** 任务类型（loading 页面会根据此执行不同逻辑） */
    task?: string
    /** 加载提示文字 */
    message?: string
}

/**
 * 通过 loading 页面跳转
 * 适用于需要先执行异步任务再跳转的场景
 */
export function navigateWithLoading(options: LoadingNavOptions) {
    const { redirect, task = '', message = '加载中...' } = options
    const params = new URLSearchParams({
        redirect: encodeURIComponent(redirect),
        task,
        message: encodeURIComponent(message),
    })
    uni.navigateTo({
        url: `/pages/common/loading/index?${params.toString()}`
    })
}

/**
 * 跳转到错误页面
 */
export function navigateToError(message: string, redirect?: string) {
    const params = new URLSearchParams({
        message: encodeURIComponent(message),
    })
    if (redirect) {
        params.set('redirect', encodeURIComponent(redirect))
    }
    uni.redirectTo({
        url: `/pages/common/error/index?${params.toString()}`
    })
}

/** TabBar 页面列表 */
export const TAB_BAR_PAGES = [
    '/pages/home/index',
    '/pages/schedule/index',
    '/pages/notice/index',
]

/**
 * 智能跳转（自动判断 switchTab 或 navigateTo）
 */
export function smartNavigate(url: string) {
    if (TAB_BAR_PAGES.some(p => url.includes(p))) {
        uni.switchTab({ url })
    } else {
        uni.navigateTo({ url })
    }
}