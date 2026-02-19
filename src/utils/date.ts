/**
 * 日期工具函数
 * 
 * 文件：src/utils/date.ts
 */

/**
 * 获取本周一的日期
 */
export function getWeekStart(date = new Date()): Date {
    const d = new Date(date)
    const day = d.getDay()
    // 周日是 0，需要特殊处理
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
}

/**
 * 获取一周的日期数组
 * 
 * @param weekStart 周一的日期
 * @returns 7 个日期字符串，格式 'YYYY-MM-DD'
 */
export function getWeekDays(weekStart: Date): string[] {
    const days: string[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        days.push(formatDate(d))
    }
    return days
}

/**
 * 格式化日期
 * 
 * @param date 日期对象
 * @param format 格式，默认 'YYYY-MM-DD'
 */
export function formatDate(date: Date, format = 'YYYY-MM-DD'): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day)
}

/**
 * 格式化时间
 */
export function formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date): string {
    return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * 计算当前是第几周
 * 
 * @param semesterStart 学期开始日期
 */
export function getCurrentWeek(semesterStart: Date): number {
    const now = new Date()
    const diff = now.getTime() - semesterStart.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    return Math.max(1, Math.ceil((days + 1) / 7))
}

/**
 * 判断是否是今天
 */
export function isToday(date: Date): boolean {
    const today = new Date()
    return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    )
}

/**
 * 获取今天是星期几 (0-6，周一到周日)
 */
export function getTodayIndex(): number {
    const day = new Date().getDay()
    // 周日是 0，转换为 6
    return day === 0 ? 6 : day - 1
}