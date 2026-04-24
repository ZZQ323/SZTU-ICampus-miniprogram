/**
 * 附件下载工具
 *
 * 文件：src/utils/attachment.ts
 *
 * 关键规则（见 CLAUDE.md）：
 *   uni.downloadFile 直接请求学校/WebVPN 地址是不行的 —— 它不走 http 拦截器，
 *   不会自动附加 X-School-Cookies header，学校/WebVPN 看不到 cookie 就返回
 *   200 + 登录页 HTML，openDocument 拿到的是垃圾。
 *
 *   统一走后端 /proxy/attachment：后端带 cookie 请求学校资源、嗅探登录页、
 *   设 Content-Disposition 回给小程序。前端只负责拼 URL + 把本地 cookies
 *   当 header 传过去。
 */

import { BASE_URL } from '@/utils/http'
import { getSchoolCookies, getUserId } from '@/utils/cookie-manager'
import type { Attachment } from '@/types/info'

/** 拼接代理下载 URL（未编码的原始学校 URL + 文件名 → 完整 BASE_URL/proxy/attachment?…） */
export function buildProxyAttachmentUrl(rawUrl: string, filename?: string): string {
    const qs: string[] = [`url=${encodeURIComponent(rawUrl)}`]
    if (filename) qs.push(`filename=${encodeURIComponent(filename)}`)
    return `${BASE_URL}/proxy/attachment?${qs.join('&')}`
}

/** 图片代理 URL —— 图片通过 previewImage 打开，走 /proxy/image（公开，可无 cookie） */
export function buildProxyImageUrl(rawUrl: string): string {
    return `${BASE_URL}/proxy/image?url=${encodeURIComponent(rawUrl)}`
}

/** 返回 downloadFile 需要的 header（X-School-Cookies + X-User-Id） */
export function attachmentHeaders(): Record<string, string> {
    return {
        'X-School-Cookies': getSchoolCookies(),
        'X-User-Id': getUserId(),
    }
}

/** 是否为图片类附件（优先看 type，其次扩展名兜底） */
export function isImageAttachment(att: Attachment): boolean {
    if (att.type === 'image') return true
    const lower = (att.name + ' ' + att.url).toLowerCase()
    return /\.(jpe?g|png|gif|webp|bmp)(\?|$)/.test(lower)
}

/** 把 downloadFile 的 fail/statusCode 映射成用户能看懂的文案。 */
export function describeDownloadError(statusCode?: number, errMsg?: string): string {
    if (statusCode === 401 || statusCode === 403) return '登录已过期，请重新登录后再下载'
    if (statusCode === 404) return '文件已失效或被学校删除'
    if (statusCode && statusCode >= 500) return `学校服务异常 (${statusCode})`
    if (statusCode && statusCode !== 200) return `下载失败 (${statusCode})`
    if (errMsg && errMsg.includes('timeout')) return '下载超时，稍后重试'
    return errMsg ? `下载失败：${errMsg}` : '下载失败'
}
