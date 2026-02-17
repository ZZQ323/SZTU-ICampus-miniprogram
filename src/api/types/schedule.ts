/** 课程项 */
export interface CourseItem {
    id: string
    name: string
    teacher: string
    location: string
    dayOfWeek: number  // 1-7
    startSection: number
    endSection: number
    weeks: string  // e.g. "1-16周"
}

/** 周课表 */
export interface WeekScheduleVo {
    weekNum: number
    startDate: string
    endDate: string
    courses: CourseItem[]
}

/** 节次时间映射 */
export const SECTION_TIMES: Record<number, string> = {
    1: '08:30', 2: '09:20', 3: '10:20', 4: '11:10',
    5: '14:00', 6: '14:50', 7: '15:50', 8: '16:40',
    9: '19:00', 10: '19:50', 11: '20:40'
}