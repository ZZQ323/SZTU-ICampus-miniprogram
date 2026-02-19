/**
 * 课表相关 Hook
 * 
 * 文件：src/hooks/useSchedule.ts
 * 
 * 封装课表数据获取和周次切换逻辑
 */

import { ref, computed } from 'vue'
import { scheduleApi } from '@/api/schedule'
import { getWeekStart, getWeekDays, formatDate } from '@/utils/date'
import type { CourseInfo } from '@/api/types/schedule'

/**
 * 课表 Hook
 * 
 * 使用示例：
 * ```ts
 * const { 
 *   courses, loading, currentWeek, weekDays,
 *   fetchCourses, changeWeek, getCourse 
 * } = useSchedule()
 * 
 * onMounted(() => fetchCourses())
 * ```
 */
export function useSchedule() {
    // 状态
    const courses = ref<CourseInfo[]>([])
    const loading = ref(false)
    const error = ref('')
    const currentWeek = ref(1)
    const currentSemester = ref('')
    const weekStart = ref(getWeekStart())

    // 计算属性
    const weekDays = computed(() => getWeekDays(weekStart.value))
    const hasCourses = computed(() => courses.value.length > 0)

    // 节次数组 (0-10，对应第1-11节)
    const sections = Array.from({ length: 11 }, (_, i) => i)

    /**
     * 获取课表数据
     */
    async function fetchCourses(week?: number, semester?: string) {
        loading.value = true
        error.value = ''

        try {
            const res = await scheduleApi.getCourseTable({
                week: week ?? currentWeek.value,
                semester: semester ?? (currentSemester.value || undefined),
            })
            courses.value = res.data.courses || []
        } catch (e: any) {
            error.value = e?.message || '获取课表失败'
            console.error('获取课表失败', e)
        } finally {
            loading.value = false
        }
    }

    /**
     * 切换周次
     */
    function changeWeek(delta: number) {
        const newWeek = currentWeek.value + delta
        if (newWeek < 1 || newWeek > 20) return

        currentWeek.value = newWeek

        // 更新周起始日期
        const d = new Date(weekStart.value)
        d.setDate(d.getDate() + delta * 7)
        weekStart.value = d

        // 重新获取课表
        fetchCourses(newWeek)
    }

    /**
     * 跳转到指定周
     */
    function goToWeek(week: number) {
        if (week < 1 || week > 20) return

        const delta = week - currentWeek.value
        currentWeek.value = week

        const d = new Date(getWeekStart())
        d.setDate(d.getDate() + delta * 7)
        weekStart.value = d

        fetchCourses(week)
    }

    /**
     * 获取指定位置的课程
     */
    function getCourse(col: number, row: number): CourseInfo | undefined {
        return courses.value.find(c => c.col === col && c.row === row)
    }

    /**
     * 获取指定位置是否有课
     */
    function hasCourse(col: number, row: number): boolean {
        return !!getCourse(col, row)
    }

    /**
     * 显示课程详情弹窗
     */
    function showCourseDetail(course: CourseInfo) {
        uni.showModal({
            title: course.courseName,
            content: [
                `教师: ${course.teacher || '未知'}`,
                `地点: ${course.location}`,
                `时间: ${course.courseTime}`,
                `周次: ${course.courseWeeks}`,
            ].join('\n'),
            showCancel: false,
        })
    }

    /**
     * 刷新课表
     */
    function refresh() {
        return fetchCourses()
    }

    return {
        // 状态
        courses,
        loading,
        error,
        currentWeek,
        currentSemester,
        weekStart,

        // 计算属性
        weekDays,
        hasCourses,
        sections,

        // 方法
        fetchCourses,
        changeWeek,
        goToWeek,
        getCourse,
        hasCourse,
        showCourseDetail,
        refresh,
    }
}