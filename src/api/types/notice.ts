/** 公告类型 */
export type NoticeType = 'announcement' | 'department'

/** 公告项 */
export interface NoticeItem {
    id: string
    title: string
    type: NoticeType
    department?: string
    date: string
    url?: string
}

/** 公告列表响应 */
export interface NoticeListVo {
    list: NoticeItem[]
    total: number
    hasMore: boolean
}