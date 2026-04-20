/**
 * 活动日历类型
 *
 * 对应后端 ActivityIndexItem。
 */

export interface ActivityItem {
    // 溯源
    articleId: string
    channelId: string
    sourceId: string
    /** 来源单位名（如"党委组织部"）*/
    sourceOrgName?: string
    /** 原文 URL，可跳转 */
    articleUrl?: string

    // LLM 抽取
    type?: string            // 讲座/比赛/...
    title: string
    startAt?: string         // "YYYY-MM-DDTHH:mm" 或 "YYYY-MM-DD"
    endAt?: string
    location?: string
    registration?: string
    summary?: string
    confidence: number

    // 派生
    /** 开始时间毫秒戳；null 表示"时间待定" */
    startAtEpoch?: number | null
}

export interface ActivityStats {
    timelineSize: number
    pendingSize: number
}
