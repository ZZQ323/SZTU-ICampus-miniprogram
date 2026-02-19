/**
 * 课表相关类型定义
 * 
 * 文件：src/api/types/schedule.ts
 */

/** 课程信息（对应 CourseTableVO.CourseInfo） */
export interface CourseInfo {
    /** 第几节课，0-based */
    row: number
    /** 星期几，0=周一，6=周日 */
    col: number
    courseId: string
    courseName: string
    courseWeeks: string
    courseTime: string
    location: string
    teacher?: string
}

/** 课表响应 */
export interface CourseTableVO {
    courses: CourseInfo[]
}

/** 星期名称 */
export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 节次时间（可选，用于展示） */
export const SECTION_TIMES = [
    '08:30-09:15',
    '09:20-10:05',
    '10:20-11:05',
    '11:10-11:55',
    '14:00-14:45',
    '14:50-15:35',
    '15:50-16:35',
    '16:40-17:25',
    '19:00-19:45',
    '19:50-20:35',
    '20:40-21:25',
]