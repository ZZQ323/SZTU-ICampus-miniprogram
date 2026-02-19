/** 活动项 */
export interface ActivityItem {
    id: string
    title: string
    date: string
    time?: string
    location?: string
    organizer?: string
    description?: string
}

/** 日历日期活动 */
export interface CalendarDayVo {
    date: string
    activities: ActivityItem[]
}