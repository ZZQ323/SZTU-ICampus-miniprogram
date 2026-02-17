/** 格式化日期 YYYY-MM-DD */
export function formatDate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** 获取本周一日期 */
export function getWeekStart(date = new Date()): Date {
    const d = new Date(date)
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    return d
}

/** 获取一周日期数组 */
export function getWeekDays(startDate: Date): string[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate)
        d.setDate(d.getDate() + i)
        return formatDate(d)
    })
}

/** 星期名称 */
export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']