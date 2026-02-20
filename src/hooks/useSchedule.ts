/**
 * 课表数据处理 Hook
 * 
 * 文件：src/hooks/useSchedule.ts
 */

import { ref, computed } from 'vue'
import { academicApi } from '@/api/auth-apis'

// ==================== 类型定义 ====================

export interface CourseInfo {
  courseName: string
  location: string
  teacher: string
  startWeek: number
  endWeek: number
  dayOfWeek: number  // 0-6，0 = 周一
  startSlot: number  // 起始节次
  endSlot: number    // 结束节次
  color?: string
}

export interface ScheduleData {
  courses: CourseInfo[]
  currentWeek: number
  semester: string
}

// ==================== 常量 ====================

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const TIME_SLOTS = [
  { row: 1, label: '1-2', time: '08:00-09:40' },
  { row: 2, label: '3-4', time: '10:00-11:40' },
  { row: 3, label: '5-6', time: '14:00-15:40' },
  { row: 4, label: '7-8', time: '16:00-17:40' },
  { row: 5, label: '9-10', time: '19:00-20:40' },
]

const COURSE_COLORS = [
  '#E3F2FD', // 浅蓝
  '#E8F5E9', // 浅绿
  '#FFF3E0', // 浅橙
  '#F3E5F5', // 浅紫
  '#E0F7FA', // 浅青
  '#FCE4EC', // 浅粉
  '#FFFDE7', // 浅黄
  '#EFEBE9', // 浅棕
]

// ==================== Hook ====================

export function useSchedule() {
  // 状态
  const courses = ref<CourseInfo[]>([])
  const currentWeek = ref(1)
  const semester = ref('')
  const loading = ref(false)

  // 课程颜色映射
  const colorMap = new Map<string, string>()

  // ==================== 计算属性 ====================

  // 星期几的显示数据
  const weekDays = computed(() => {
    const today = new Date()
    const dayOfWeek = today.getDay() || 7 // 转换为 1-7
    const monday = new Date(today)
    monday.setDate(today.getDate() - dayOfWeek + 1)

    return WEEKDAYS.map((label, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return {
        label,
        value: index,
        date: `${date.getMonth() + 1}/${date.getDate()}`
      }
    })
  })

  // 时间节次数据
  const timeSlots = computed(() => TIME_SLOTS)

  // ==================== 方法 ====================

  /**
   * 获取课表数据
   */
  async function fetchSchedule(week?: number) {
    loading.value = true
    try {
      const res = await academicApi.getSchedule({ week })
      if (res.data) {
        updateCourses(res.data)
      }
    } catch (e) {
      console.error('[useSchedule] 获取课表失败', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新课表数据
   */
  function updateCourses(data: ScheduleData | any) {
    if (data.courses) {
      courses.value = data.courses
    }
    if (data.currentWeek) {
      currentWeek.value = data.currentWeek
    }
    if (data.semester) {
      semester.value = data.semester
    }
  }

  /**
   * 获取指定位置的课程
   */
  function getCourse(row: number, day: number): CourseInfo | null {
    return courses.value.find(c =>
      c.dayOfWeek === day &&
      c.startSlot <= row * 2 &&
      c.endSlot >= row * 2 - 1 &&
      c.startWeek <= currentWeek.value &&
      c.endWeek >= currentWeek.value
    ) || null
  }

  /**
   * 获取课程颜色
   */
  function getCourseColor(course: CourseInfo | null): string {
    if (!course) return '#f5f5f5'

    // 如果已分配颜色，直接返回
    if (colorMap.has(course.courseName)) {
      return colorMap.get(course.courseName)!
    }

    // 分配新颜色
    const colorIndex = colorMap.size % COURSE_COLORS.length
    const color = COURSE_COLORS[colorIndex]
    colorMap.set(course.courseName, color)
    return color
  }

  /**
   * 判断是否是今天
   */
  function isToday(dayIndex: number): boolean {
    const today = new Date().getDay()
    // 转换：周日=0 → 6，其他减1
    const todayIndex = today === 0 ? 6 : today - 1
    return dayIndex === todayIndex
  }

  /**
   * 显示课程详情
   */
  function showCourseDetail(row: number, day: number) {
    const course = getCourse(row, day)
    if (course) {
      // 可以触发弹窗或其他操作
      console.log('[useSchedule] 显示课程详情', course)
    }
  }

  // ==================== 返回 ====================

  return {
    // 状态
    courses,
    currentWeek,
    semester,
    loading,

    // 计算属性
    weekDays,
    timeSlots,

    // 方法
    fetchSchedule,
    updateCourses,
    getCourse,
    getCourseColor,
    isToday,
    showCourseDetail,
  }
}