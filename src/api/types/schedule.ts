/** 课程信息（对应 CourseTableVO.CourseInfo） */
export interface CourseInfo {
    row: number           // 行位置（第几节课，0-based）
    col: number           // 列位置（0=周一，6=周日）
    courseId: string
    courseName: string
    courseWeeks: string   // 课程周次
    courseTime: string    // 课程时间
    location: string      // 上课教室
    teacher?: string      // 教师
}

/** 课表响应（对应 CourseTableVO.java） */
export interface CourseTableVO {
    courses: CourseInfo[]
}

/** 节次时间映射（根据学校作息） */
export const SECTION_TIMES: Record<number, string> = {
    0: '08:30', 1: '09:20', 2: '10:20', 3: '11:10',
    4: '14:00', 5: '14:50', 6: '15:50', 7: '16:40',
    8: '19:00', 9: '19:50', 10: '20:40'
}

/** 星期名称 */
export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']