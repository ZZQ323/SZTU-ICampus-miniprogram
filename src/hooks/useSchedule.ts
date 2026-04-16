/**
 * 课表数据处理 Hook
 *
 * 文件：src/hooks/useSchedule.ts
 *
 * ⭐ 根据 SZTU 实际上课时间表配置时间槽：
 * 上午 1-2节 8:30-9:55, 3-4节 10:15-11:40, 5节 11:45-12:25
 * 下午 6-7节 14:00-15:25, 8-9节 15:45-17:10, 10节 17:15-17:55
 * 晚上 11-12节 19:00-20:20, 13-14节 20:30-21:50
 *
 * 涂色方案：按 courseName 哈希分配柔和色，同课程同色
 */

import { ref, computed } from 'vue'
import { academicApi } from '@/api/auth-apis'

// ==================== 后端返回的课程数据结构 ====================

export interface CourseInfo {
    row: number       // 行位置（0-based，后端解析的节次分组）
    col: number       // 列位置（0=周一，6=周日）
    courseId: string
    courseName: string
    courseWeeks: string   // 周次范围（如 "1-16"）
    courseTime: string   // 时间范围（如 "08:30-09:10"）
    location: string
    teacher: string
}

// ==================== SZTU 上课时间表（精确到 5 分钟） ====================

export const SZTU_TIME_TABLE = [
    { slot: 1, start: '08:30', end: '09:10', period: '上午' },
    { slot: 2, start: '09:15', end: '09:55', period: '上午' },
    { slot: 3, start: '10:15', end: '10:55', period: '上午' },
    { slot: 4, start: '11:00', end: '11:40', period: '上午' },
    { slot: 5, start: '11:45', end: '12:25', period: '上午' },
    { slot: 6, start: '14:00', end: '14:40', period: '下午' },
    { slot: 7, start: '14:45', end: '15:25', period: '下午' },
    { slot: 8, start: '15:45', end: '16:25', period: '下午' },
    { slot: 9, start: '16:30', end: '17:10', period: '下午' },
    { slot: 10, start: '17:15', end: '17:55', period: '下午' },
    { slot: 11, start: '19:00', end: '19:40', period: '晚上' },
    { slot: 12, start: '19:45', end: '20:20', period: '晚上' },  // 11-12 合并为一大节
    { slot: 13, start: '20:30', end: '21:10', period: '晚上' },
    { slot: 14, start: '21:15', end: '21:50', period: '晚上' },  // 13-14 合并为一大节
]

/** 课表网格的行（每行 = 两节课合并） */
export const TIME_SLOTS = [
    { row: 0, label: '1-2节', time: '8:30-9:55', period: '上午' },
    { row: 1, label: '3-4节', time: '10:15-11:40', period: '上午' },
    { row: 2, label: '5节', time: '11:45-12:25', period: '上午' },
    { row: 3, label: '6-7节', time: '14:00-15:25', period: '下午' },
    { row: 4, label: '8-9节', time: '15:45-17:10', period: '下午' },
    { row: 5, label: '10节', time: '17:15-17:55', period: '下午' },
    { row: 6, label: '11-12节', time: '19:00-20:20', period: '晚上' },
    { row: 7, label: '13-14节', time: '20:30-21:50', period: '晚上' },
]

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * 课程涂色方案 —— 柔和色板
 * 同一门课（按 courseName）分配同一颜色
 */
const COURSE_COLORS = [
    { bg: '#E3F2FD', text: '#1565C0' },  // 蓝
    { bg: '#E8F5E9', text: '#2E7D32' },  // 绿
    { bg: '#FFF3E0', text: '#E65100' },  // 橙
    { bg: '#F3E5F5', text: '#6A1B9A' },  // 紫
    { bg: '#E0F7FA', text: '#00695C' },  // 青
    { bg: '#FCE4EC', text: '#AD1457' },  // 粉
    { bg: '#FFFDE7', text: '#F57F17' },  // 黄
    { bg: '#EFEBE9', text: '#4E342E' },  // 棕
    { bg: '#E8EAF6', text: '#283593' },  // 靛蓝
    { bg: '#F1F8E9', text: '#33691E' },  // 浅绿
]

// ==================== Hook ====================

export function useSchedule() {
    const courses = ref<CourseInfo[]>([])
    const currentWeek = ref(1)
    const currentSemester = ref('')
    const loading = ref(false)
    const rawJson = ref('')          // 调试用：原始 JSON 响应
    const initDone = ref(false)      // 教务 cookie 是否已初始化
    const error = ref('')

    // 课程颜色映射（按 courseName）
    const colorMap = new Map<string, typeof COURSE_COLORS[0]>()

    // ==================== 计算属性 ====================

    const weekDays = computed(() => {
        const today = new Date()
        const dayOfWeek = today.getDay() || 7
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

    const timeSlots = computed(() => TIME_SLOTS)

    // ==================== 方法 ====================

    /** 初始化教务系统 Cookie（必须在获取课表前调用） */
    async function initAcademic() {
        if (initDone.value) return
        try {
            await academicApi.initAcademic()
            initDone.value = true
        } catch (e: any) {
            console.error('[useSchedule] 教务系统初始化失败', e)
            error.value = '教务系统初始化失败: ' + (e.message || '未知错误')
            throw e
        }
    }

    /** 获取课表 */
    async function fetchSchedule(week?: string, semester?: string) {
        loading.value = true
        error.value = ''
        try {
            // 确保教务 cookie 已初始化
            if (!initDone.value) {
                await initAcademic()
            }

            const params = (week || semester) ? { week, semester } : undefined
            const res = await academicApi.getSchedule(params)

            // 保存原始 JSON（调试用）
            rawJson.value = JSON.stringify(res, null, 2)

            // 解析课程数据
            if (res && res.courses) {
                courses.value = res.courses
            } else if (res && Array.isArray(res)) {
                courses.value = res
            } else {
                courses.value = []
            }
        } catch (e: any) {
            console.error('[useSchedule] 获取课表失败', e)
            error.value = e.message || '获取课表失败'
            rawJson.value = JSON.stringify({ error: e.message || '请求失败' }, null, 2)
        } finally {
            loading.value = false
        }
    }

    /** 获取课程颜色（同课程同色） */
    function getCourseColor(courseName: string): typeof COURSE_COLORS[0] {
        if (colorMap.has(courseName)) {
            return colorMap.get(courseName)!
        }
        const idx = colorMap.size % COURSE_COLORS.length
        const color = COURSE_COLORS[idx]
        colorMap.set(courseName, color)
        return color
    }

    /** 判断是否是今天 */
    function isToday(dayIndex: number): boolean {
        const today = new Date().getDay()
        const todayIndex = today === 0 ? 6 : today - 1
        return dayIndex === todayIndex
    }

    return {
        courses, currentWeek, currentSemester, loading, error,
        rawJson, initDone,
        weekDays, timeSlots,
        initAcademic, fetchSchedule, getCourseColor, isToday,
    }
}
