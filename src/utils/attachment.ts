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

/**
 * 把正文 HTML 里所有指向学校域名的 <img src="..."> 改写成 /proxy/image？url=...
 *
 * 为什么要这么做（真机才暴露出来的坑）：
 *   小程序 <image> 组件走的是 native 图片加载通道，不经过 axios 拦截器，
 *   也不带 X-School-Cookies。直接访问学校 WebVPN 域名会：
 *     1. 撞上学校自签 TLS 证书 → 真机 WeChat 握手超时
 *     2. 撞上需要 cookie 的资源（少数） → 302 到登录页再挂
 *   开发者工具因为和 PC 浏览器共享信任/会话，能跑通；真机就转圈，也没有 console
 *   报错、没有网络请求记录（native loader 不在 devtools HTTP 面板里）。
 *
 *   解法：全部走后端 /proxy/image。后端用 trust-all HttpClient + Host/Referer 伪装，
 *   一次性解决证书 + cookie + 反代问题。/proxy/image 在 CookieAuthFilter 白名单里，
 *   不需要前端请求头也能用，正合适给 <image> 组件调。
 *
 * 仅改写学校域名（*.sztu.edu.cn），其它域名（比如公文里偶尔出现的 mp.weixin.qq.com
 * 图）保持原样——我们的 proxy 白名单也只放行学校域，改了反而打不开。
 */
const IMG_TAG_RE = /<img\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi

export function rewriteSchoolImgs(html: string): string {
    if (!html) return ''
    return html.replace(IMG_TAG_RE, (tag, quote, src) => {
        // 只改 http(s) 的绝对 URL；data:image base64、相对路径由后端 cleanHtml 先处理过
        if (!/^https?:\/\//i.test(src)) return tag
        if (!/\.sztu\.edu\.cn(?::\d+)?\//i.test(src)) return tag
        const proxied = buildProxyImageUrl(src)
        return tag.replace(`${quote}${src}${quote}`, `${quote}${proxied}${quote}`)
    })
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

/**
 * 把附件信息映射成 uni.openDocument 认识的 fileType。
 * openDocument 支持：'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx'。
 * 其它（zip/rar/7z）返回空串，代表"不能预览"。
 *
 * URL 是 download.jsp?... 时，downloadFile 拿回来的 tempFilePath 可能没扩展名，
 * 必须显式告诉 openDocument filetype，否则真机也会 "filetype not supported"。
 */
export function resolveOpenDocFileType(att: Attachment): string {
    const hay = (att.name + ' ' + att.url).toLowerCase()
    // 先走扩展名，最准；URL 里常有 downloadattachurl 之类噪声，放后面
    if (/\.pdf(\?|$)/.test(hay)) return 'pdf'
    if (/\.docx(\?|$)/.test(hay)) return 'docx'
    if (/\.doc(\?|$)/.test(hay)) return 'doc'
    if (/\.xlsx(\?|$)/.test(hay)) return 'xlsx'
    if (/\.xls(\?|$)/.test(hay)) return 'xls'
    if (/\.pptx(\?|$)/.test(hay)) return 'pptx'
    if (/\.ppt(\?|$)/.test(hay)) return 'ppt'
    // 扩展名匹不到再退回 type 提示
    switch (att.type) {
        case 'pdf': return 'pdf'
        case 'word': return 'docx'
        case 'excel': return 'xlsx'
        case 'ppt': return 'pptx'
        default: return ''   // archive / file / 未知 —— openDocument 打不开
    }
}

/** 是否是压缩包（openDocument 不支持，需要特别提示用户） */
export function isArchiveAttachment(att: Attachment): boolean {
    if (att.type === 'archive') return true
    return /\.(zip|rar|7z)(\?|$)/.test((att.name + ' ' + att.url).toLowerCase())
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
