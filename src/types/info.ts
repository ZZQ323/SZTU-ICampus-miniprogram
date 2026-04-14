/**
 * 信息流类型定义
 * 
 * 文件：src/types/info.ts
 * 
 * ⭐ 修复：
 * 1. Attachment.type 改为可选（后端 ContentParserResult.AttachmentInfo 中 type 非必填）
 * 2. InfoContent 的导航字段改为扁平结构，与后端 ContentParserResult 一致
 *    （后端直接返回 prevId/prevTitle/nextId/nextTitle，不嵌套在 navigation 对象中）
 */

// ==================== 频道与分类 ====================

export interface Channel {
    id: string
    name: string
    description?: string
    icon: string
    /** 梯队：1=默认订阅, 2=用户订阅, 3=低频可选 */
    tier?: number
    sort?: number
    categories?: Category[]
}

export interface Category {
    id: string
    name: string
    code?: string
    color?: string
}

export interface CategoryTree {
    channels: Channel[]
}

export interface ChannelWithUnread extends Channel {
    unreadCount: number
}

/** 频道 Tab 配置（用于 notice.vue 渲染） */
export interface ChannelTab {
    id: string
    name: string
    hasCategories: boolean
}

// ==================== 列表项 ====================

export interface InfoItemMeta {
    id: string
    url: string
    title: string
    channelId?: string
    author?: string
    source?: string
    crawledAt?: string
    extra?: string
    categoryName?: string
    category?: string
    categoryCode?: string
    publishDate?: string
    summary?: string
    coverImage?: string
    hasAttachment?: boolean
    detailUrl?: string
    originalUrl?: string
    department?: string
    
}

export interface InfoListResult {
    items: InfoItemMeta[]
    totalPage: number
    currentPage: number
    latestId: string
    hasMore: boolean
    sourceId?: string
    channelId?: string
}

// ==================== 详情 ====================

/**
 * 详情内容
 * 
 * ⭐ 字段与后端 ContentParserResult.java 一一对应：
 * - htmlContent 在后端返回，前端映射为 content
 * - prevId/prevTitle/nextId/nextTitle 是扁平字段（不嵌套）
 */
export interface InfoContent {
    id: string
    title: string
    content: string
    plainText?: string
    author?: string
    publishTime?: string
    sourceId?: string
    sourceName?: string
    channelId?: string
    categoryCode?: string
    categoryName?: string
    attachments: Attachment[]

    /** 上一篇 ID */
    prevId?: string
    /** 上一篇标题 */
    prevTitle?: string
    /** 下一篇 ID */
    nextId?: string
    /** 下一篇标题 */
    nextTitle?: string

    cachedAt?: number
}

/**
 * 附件信息
 * 
 * ⭐ type 改为可选，与后端 ContentParserResult.AttachmentInfo 一致
 */
export interface Attachment {
    name: string
    url: string
    type?: string
    size?: string
}

/**
 * 导航信息（保留类型定义，但 InfoContent 不再使用嵌套结构）
 * @deprecated 已改为扁平字段直接放在 InfoContent 上
 */
export interface Navigation {
    prevId?: string
    prevTitle?: string
    nextId?: string
    nextTitle?: string
}

// ==================== API 参数 ====================

export interface InfoListParams {
    channelId?: string
    categoryCode?: string
    page?: number
    pageSize?: number
}

export interface MarkReadParams {
    channelId: string
    latestId: string
}

// ==================== 未读状态 ====================

export interface ChannelUnreadState {
    serverLatestId: string
    lastReadId: string
    readIds: Set<string>
}

// ==================== 分类列表（兼容现有代码） ====================

export const CATEGORY_LIST = [
    { code: '', name: '全部' },
    { code: '1018', name: '教务', color: '#0052d9' },
    { code: '1019', name: '科研', color: '#07c160' },
    { code: '1020', name: '行政', color: '#fa5151' },
    { code: '1021', name: '学工', color: '#ff976a' },
    { code: '1022', name: '校园', color: '#9c27b0' },
]

export const CATEGORY_MAP: Record<string, string> = {
    '1018': '教务',
    '1019': '科研',
    '1020': '行政',
    '1021': '学工',
    '1022': '校园',
}

export const CATEGORY_COLOR_MAP: Record<string, string> = {
    '1018': '#0052d9',
    '1019': '#07c160',
    '1020': '#fa5151',
    '1021': '#ff976a',
    '1022': '#9c27b0',
}