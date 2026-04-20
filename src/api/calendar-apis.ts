/**
 * 校历 API
 *
 * 文件：src/api/calendar-apis.ts
 *
 * 后端：
 *   GET /calendar/v1/years     → string[]          // 学年列表，降序
 *   GET /calendar/v1/{year}    → CalendarPayload   // 某学年的春秋两学期图（/proxy/image 已封装）
 *
 * 注意：/calendar/** 是公开接口，无需 cookies。
 */

import { request } from '@/utils/http'

export interface CalendarSemester {
    label: string       // 如 "春季学期" / "秋季学期"
    imageUrl: string    // 后端已封装 /proxy/image?url=... 前端直接用
}

export interface CalendarPayload {
    year: string        // "YYYY-YYYY"
    autumn?: CalendarSemester | null
    spring?: CalendarSemester | null
}

export const calendarApi = {
    getYears: () =>
        request.get<string[]>('/calendar/v1/years'),

    getByYear: (year: string) =>
        request.get<CalendarPayload | null>(`/calendar/v1/${year}`),
}
