/**
 * 课表数据处理 Hook
 *
 * 文件：src/hooks/useSchedule.ts
 *
 * ⭐ 视觉渲染约定（2D 画布版，2026-04）：
 *   - 画布按 5 分钟为一个基本格，课程卡绝对定位（top/height = startMin/endMin 分钟换算）
 *   - 时间列侧边 label 按 SZTU_TIME_TABLE 绝对定位，与横轴课程卡同刻度
 *   - 休息时间（大课间、午休、晚餐等）不画任何东西，留白比例 = 真实分钟比例
 *   - 页面常量 DAY_START_MIN=7:00 / DAY_END_MIN=23:00 定义在 schedule.vue
 *
 * ⚠️ SZTU_TIME_TABLE 每学年开学前核对：https://jw.sztu.edu.cn/fwc/sksj.htm
 *   · 学校那个页面是纯图（<img src=__local/.../xxx.png>），不可机器 parse，只能手抄
 *   · 上次核对：2026-04（对应学校 2022-02 发布的时间表）
 *   · 若学校改了时间表，只改下面这一个常量，画布和课程定位会自动重算
 */

import { ref, computed } from 'vue'
import { academicApi } from '@/api/auth-apis'

// ==================== 后端返回的课程数据结构 ====================

export interface CourseInfo {
    row: number       // 行位置（后端解析的节次分组，2D 画布模式下不再使用，仅兜底）
    col: number       // 列位置（0=周一，6=周日）
    courseId: string
    courseName: string
    courseWeeks: string   // 周次范围（如 "1-16"）
    courseTime: string   // 时间范围（如 "08:30-09:10" 或 "08:30-10:00" 合并块，真实上课时间）
    location: string
    teacher: string
}

// ==================== SZTU 上课时间表（精确到 5 分钟） ====================

export interface SchoolTimeSlot {
    slot: number                             // 节次编号 1-14
    startMin: number                         // 从 00:00 起的分钟数
    endMin: number
    label: string                            // 侧边显示用（"第一节"、"第十一、十二节"）
    period: '上午' | '下午' | '晚上'
}

/** 分钟转 HH:MM 字符串 */
export function fmtMinutes(totalMin: number): string {
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 解析后端 courseTime 字符串 → { startMin, endMin }
 * 接受 "08:30-10:00" / "08:30-09:10" / "8:30-9:10"（某些源可能不补 0）
 * 解析失败返回 null（调用方自己兜底）
 */
export function parseCourseTime(s: string | undefined | null): { startMin: number; endMin: number } | null {
    if (!s) return null
    const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
    if (!m) return null
    const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    const endMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10)
    if (endMin <= startMin) return null
    return { startMin, endMin }
}

/**
 * 深技大上课时间表（14 节 + 两个 80min 合并块）
 *
 * 11-12 节和 13-14 节在学校时间表里本身就是合并的大节（80min 连上），用一个 slot 表示即可，
 * 不拆成两个 40min 再手动合。label 文案与学校官方图一致。
 */
export const SZTU_TIME_TABLE: SchoolTimeSlot[] = [
    { slot: 1,  startMin: 8 * 60 + 30,  endMin: 9 * 60 + 10,  label: '第一节',         period: '上午' },
    { slot: 2,  startMin: 9 * 60 + 15,  endMin: 9 * 60 + 55,  label: '第二节',         period: '上午' },
    { slot: 3,  startMin: 10 * 60 + 15, endMin: 10 * 60 + 55, label: '第三节',         period: '上午' },
    { slot: 4,  startMin: 11 * 60,      endMin: 11 * 60 + 40, label: '第四节',         period: '上午' },
    { slot: 5,  startMin: 11 * 60 + 45, endMin: 12 * 60 + 25, label: '第五节',         period: '上午' },
    { slot: 6,  startMin: 14 * 60,      endMin: 14 * 60 + 40, label: '第六节',         period: '下午' },
    { slot: 7,  startMin: 14 * 60 + 45, endMin: 15 * 60 + 25, label: '第七节',         period: '下午' },
    { slot: 8,  startMin: 15 * 60 + 45, endMin: 16 * 60 + 25, label: '第八节',         period: '下午' },
    { slot: 9,  startMin: 16 * 60 + 30, endMin: 17 * 60 + 10, label: '第九节',         period: '下午' },
    { slot: 10, startMin: 17 * 60 + 15, endMin: 17 * 60 + 55, label: '第十节',         period: '下午' },
    { slot: 11, startMin: 19 * 60,      endMin: 20 * 60 + 20, label: '第十一、十二节', period: '晚上' },
    { slot: 13, startMin: 20 * 60 + 30, endMin: 21 * 60 + 50, label: '第十三、十四节', period: '晚上' },
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

    const timeSlots = computed(() => SZTU_TIME_TABLE)

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
