/**
 * 课表相关 API
 * 
 * 文件：src/api/schedule.ts
 */

import request from '@/utils/http'
import type { CourseTableData } from '@/types/schedule'

export interface CrouseTableQuery {
    week?: number
    semester?: string
}

export const scheduleApi = {
    /**
     * 获取课表
     */
    getCourseTable: (query?: CrouseTableQuery) =>
        request.post<CourseTableData>('/acdm/v1/schedule', { params: query }),

    /**
     * 初始化教务系统 Cookie（懒初始化）
     */
    initAcademic: () =>
        request.get<void>('/acdm/v1/refresh/cookies'),
}