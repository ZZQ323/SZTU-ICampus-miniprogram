/**
 * 课表数据处理 Hook
 * 
 * 文件路径: src/hooks/useSchedule.ts
 */

import { ref, reactive, computed } from 'vue'
import type { CourseInfo, TimeSlot, WeekDay, ColorConfig } from '@/types/schedule'

/** 默认时间段配置 */
const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { row: 0, label: '1-2', time: '08:30-10:05' },
  { row: 1, label: '3-4', time: '10:25-12:00' },
  { row: 2, label: '5-6', time: '14:00-15:35' },
  { row: 3, label: '7-8', time: '15:55-17:30' },
  { row: 4, label: '9-10', time: '19:00-20:35' }
]

/** 默认颜色配置 */
const DEFAULT_COLORS: string[] = [
  '#FFB6C1', '#87CEEB', '#98FB98', '#DDA0DD',
  '#F0E68C', '#FFA07A', '#B0E0E6', '#FFDAB9'
]

export function useSchedule() {
  // ==================== 状态 ====================
  
  const courses = ref<CourseInfo[]>([])
  const currentWeek = ref(1)
  const loading = ref(true)
  
  const colorConfig = reactive<ColorConfig>({
    colors: [...DEFAULT_COLORS]
  })
  
  // 课程颜色映射缓存
  const courseColorMap = new Map<string, string>()
  
  // ==================== 计算属性 ====================
  
  /** 星期信息（带日期） */
  const weekDays = computed<WeekDay[]>(() => {
    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const today = new Date()
    const dayOfWeek = today.getDay() || 7
    
    return labels.map((label, index) => {
      const diff = index + 1 - dayOfWeek
      const date = new Date(today)
      date.setDate(today.getDate() + diff)
      
      return {
        label,
        value: index,
        date: `${date.getMonth() + 1}/${date.getDate()}`
      }
    })
  })
  
  /** 时间段配置 */
  const timeSlots = DEFAULT_TIME_SLOTS
  
  // ==================== 方法 ====================
  
  /** 更新课表数据 */
  function updateCourses(data: CourseInfo[] | { courses: CourseInfo[] }) {
    if (Array.isArray(data)) {
      courses.value = data
    } else if (data?.courses) {
      courses.value = data.courses
    }
    loading.value = false
  }
  
  /** 获取指定位置的课程 */
  function getCourse(row: number, col: number): CourseInfo | undefined {
    return courses.value.find(c => c.row === row && c.col === col)
  }
  
  /** 获取课程颜色 */
  function getCourseColor(course: CourseInfo | undefined): string {
    if (!course) return 'transparent'
    
    if (courseColorMap.has(course.courseId)) {
      return courseColorMap.get(course.courseId)!
    }
    
    // 根据课程ID hash 选择颜色
    const hash = course.courseId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const color = colorConfig.colors[hash % colorConfig.colors.length]
    
    courseColorMap.set(course.courseId, color)
    return color
  }
  
  /** 判断是否是今天 */
  function isToday(dayIndex: number): boolean {
    const today = new Date().getDay()
    return dayIndex === (today === 0 ? 6 : today - 1)
  }
  
  /** 显示课程详情 */
  function showCourseDetail(row: number, col: number) {
    const course = getCourse(row, col)
    if (!course) return
    
    uni.showModal({
      title: course.courseName,
      content: [
        `时间: ${course.courseTime}`,
        `地点: ${course.location}`,
        `教师: ${course.teacher}`,
        `周次: ${course.courseWeeks}`
      ].join('\n'),
      showCancel: false
    })
  }
  
  /** 设置颜色配置 */
  function setColors(colors: string[]) {
    colorConfig.colors = colors
    courseColorMap.clear() // 清除缓存以应用新颜色
  }
  
  /** 清空课表 */
  function clearCourses() {
    courses.value = []
    courseColorMap.clear()
  }
  
  // ==================== 导出 ====================
  
  return {
    // 状态
    courses,
    currentWeek,
    loading,
    colorConfig,
    
    // 计算属性
    weekDays,
    timeSlots,
    
    // 方法
    updateCourses,
    getCourse,
    getCourseColor,
    isToday,
    showCourseDetail,
    setColors,
    clearCourses
  }
}
