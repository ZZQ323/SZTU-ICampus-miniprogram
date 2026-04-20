/**
 * 活动日历 API
 *
 * 文件：src/api/activity-apis.ts
 *
 * 后端公开端点（/activity/v1/** 已在 CookieAuthFilter PUBLIC_PATHS）：
 *   GET /activity/v1/upcoming?limit&includePast  → 即将到来
 *   GET /activity/v1/list?from&to&limit          → 时间范围查询
 *   GET /activity/v1/pending?limit               → 时间待定
 *   GET /activity/v1/stats                       → 索引统计
 *
 * 注意：不要和 calendar-apis.ts（校历）混淆。校历是学校官方发布的学年图片，
 * 活动日历是爬虫 + LLM 抽取出的校园事件。
 */

import { request } from '@/utils/http'
import type { ActivityItem, ActivityStats } from '@/types/activity'

/** 报告错误的原因枚举 */
export type ReportReason =
    | 'not_activity'
    | 'wrong_time'
    | 'wrong_title'
    | 'wrong_location'
    | 'other'

export interface ReportPayload {
    articleId: string
    channelId?: string
    reason: ReportReason
    note?: string
    titleSnapshot?: string
}

export const activityApi = {
    getUpcoming: (limit = 20, includePast = false) =>
        request.get<ActivityItem[]>('/activity/v1/upcoming', {
            params: { limit, includePast },
        }),

    getByRange: (from: string, to: string, limit = 100) =>
        request.get<ActivityItem[]>('/activity/v1/list', {
            params: { from, to, limit },
        }),

    getPending: (limit = 20) =>
        request.get<ActivityItem[]>('/activity/v1/pending', {
            params: { limit },
        }),

    getStats: () =>
        request.get<ActivityStats>('/activity/v1/stats'),

    /** 用户报告活动识别错误 —— B3 人机协同入口 */
    report: (payload: ReportPayload) =>
        request.post<void>('/activity/v1/report', payload),
}
