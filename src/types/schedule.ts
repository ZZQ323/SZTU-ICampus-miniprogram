/**
 * 课表相关类型定义
 * 
 * 文件路径: src/types/schedule.ts
 */

/** 课程信息 */
export interface CourseInfo {
  row: number
  col: number
  courseId: string
  courseName: string
  courseWeeks: string
  courseTime: string
  location: string
  teacher: string
}

/** 课表数据 */
export interface CourseTableData {
  courses: CourseInfo[]
}

/** 时间段 */
export interface TimeSlot {
  row: number
  label: string
  time: string
}

/** 星期信息 */
export interface WeekDay {
  label: string
  value: number
  date: string
}

/** 颜色配置 */
export interface ColorConfig {
  colors: string[]
}