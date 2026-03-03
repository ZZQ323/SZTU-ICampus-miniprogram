/**
 * 公告相关类型定义
 * 
 * 文件：src/types/announcement.ts
 */

/** 公告元数据（列表项） */
export interface AnnouncementMeta {
    /** 文章ID，全局唯一 */
    id: string
    /** 相对路径，如 info/1018/50731.htm */
    url: string
    /** 发文类别代码：1018/1019/1020/1021/1022 */
    category: string
    /** 发文类别名称：教务/科研/行政/学工/校园 */
    categoryName: string
    /** 发文单位/部门 */
    department: string
    /** 公文标题 */
    title: string
    /** 发文日期，格式 yyyy-MM-dd */
    publishDate: string
    /** 爬取时间戳 */
    crawledAt?: number
}

/** 公告详情内容 */
export interface AnnouncementContent {
    /** 文章ID */
    id: string
    /** 标题 */
    title: string
    /** 作者（发文单位） */
    author: string
    /** 发布时间 */
    publishTime: string
    /** HTML 正文（已清洗） */
    content: string
    /** 纯文本（用于搜索高亮） */
    plainText?: string
    /** 附件列表 */
    attachments: Attachment[]
    /** 上一篇 ID */
    prevId?: string
    /** 上一篇标题 */
    prevTitle?: string
    /** 下一篇 ID */
    nextId?: string
    /** 下一篇标题 */
    nextTitle?: string
    /** 缓存时间戳 */
    cachedAt?: number
}

/** 附件 */
export interface Attachment {
    /** 附件名称 */
    name: string
    /** 下载链接 */
    url: string
}

/** 公告列表响应 */
export interface AnnouncementListVo {
    /** 公告列表 */
    list: AnnouncementMeta[]
    /** 当前最新ID（用于前端比对未读） */
    latestId: string
    /** 总数 */
    total: number
    /** 是否有更多 */
    hasMore: boolean
}

/** 分类代码映射 */
export const CATEGORY_MAP: Record<string, string> = {
    '1018': '教务',
    '1019': '科研',
    '1020': '行政',
    '1021': '学工',
    '1022': '校园',
    '1029': '全部'
}

/** 分类代码列表 */
export const CATEGORY_LIST = [
    { code: '', name: '全部' },
    { code: '1018', name: '教务' },
    { code: '1019', name: '科研' },
    { code: '1020', name: '行政' },
    { code: '1021', name: '学工' },
    { code: '1022', name: '校园' },
]

/** 系统状态 */
export interface AnnouncementSystemStatus {
    /** 是否已初始化 */
    initialized: boolean
    /** 是否可运行 */
    operational: boolean
    /** 总数 */
    totalCount: number
    /** 最新ID */
    latestId: string
    /** 上次爬取时间 */
    lastCrawlTime?: number
}

/** SSE 新公告消息 */
export interface NewAnnouncementMessage {
    /** 新公告ID列表 */
    ids: string[]
    /** 新公告数量 */
    count: number
    /** 新公告元数据 */
    metas: AnnouncementMeta[]
    /** 最新ID */
    latestId: string
}