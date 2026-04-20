<!--
  活动日历页面

  文件：src/pages/calendar/calendar.vue

  布局（参考手机原生日历）：
  ┌──────────────────────────────┐
  │  ←   2026 年 4 月   →        │
  │                    [今天]    │
  ├──────────────────────────────┤
  │  日 一 二 三 四 五 六         │
  │      1  2  3  4  5  6        │
  │   7  8  9 10 11 12 13        │
  │  14 15 16 17 18 19 20        │
  │      ● 讲座                   │
  │  21 22 23 24 25 26 27        │
  │  28 29 30                    │
  ├──────────────────────────────┤
  │  ▌ 4 月 19 日（3 个活动）    │
  │  ○ 14:00 人工智能讲座         │
  │  ○ 19:30 峥嵘杯辩论赛         │
  │  ...                          │
  ├──────────────────────────────┤
  │  即将到来 / 时间待定 tab     │
  │  ○ 04-22 14:00 xxx           │
  │  ...                          │
  └──────────────────────────────┘

  数据流：
  - onShow 一次性拉 /activity/v1/upcoming?limit=100&includePast=true，覆盖当月
  - 切换月份：如果超出已加载范围，拉 /activity/v1/list?from&to
  - 点击日期：本地 filter
  - tab 切换"即将到来 / 时间待定"：pending 惰性加载
-->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { activityApi, type ReportReason } from '@/api/activity-apis'
import type { ActivityItem } from '@/types/activity'

// ==================== 状态 ====================

/** 当前展示月份 */
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth() + 1)  // 1-12

/** 选中的日期 */
const todayIso = isoDate(new Date())
const selectedDate = ref(todayIso)

/** 数据缓存：所有已加载的活动 */
const allActivities = ref<ActivityItem[]>([])
const pendingActivities = ref<ActivityItem[]>([])

const loading = ref(false)
const bottomTab = ref<'upcoming' | 'pending'>('upcoming')

// ==================== 本地隐藏（B3 即时反馈）====================

/** 用户通过报告按钮本地隐藏的活动 id 集合（uni.storage 持久化） */
const HIDDEN_KEY = 'activity:hidden-ids'
const hiddenIds = ref<Record<string, true>>(loadHidden())

function loadHidden(): Record<string, true> {
    try {
        const raw = uni.getStorageSync(HIDDEN_KEY)
        if (!raw) return {}
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
        const out: Record<string, true> = {}
        if (Array.isArray(arr)) for (const id of arr) out[String(id)] = true
        else if (arr && typeof arr === 'object') for (const k of Object.keys(arr)) out[k] = true
        return out
    } catch { return {} }
}

function persistHidden() {
    uni.setStorageSync(HIDDEN_KEY, JSON.stringify(Object.keys(hiddenIds.value)))
}

function hideLocally(articleId: string) {
    hiddenIds.value = { ...hiddenIds.value, [articleId]: true }
    persistHidden()
}

function isHidden(articleId: string): boolean {
    return hiddenIds.value[articleId] === true
}

// ==================== 月历生成 ====================

/** 6 × 7 的网格：每格是一个日期 cell */
interface DayCell {
    iso: string              // "YYYY-MM-DD"
    day: number              // 1-31
    inMonth: boolean         // 是否属于当前展示月
    isToday: boolean
    count: number            // 该日活动数
    types: string[]          // 该日活动类型（去重，最多 2）
}

const grid = computed<DayCell[]>(() => {
    const y = viewYear.value
    const m = viewMonth.value
    const first = new Date(y, m - 1, 1)
    const daysInMonth = new Date(y, m, 0).getDate()
    const startWeek = first.getDay()       // 0=Sun

    const cells: DayCell[] = []
    const prevDays = new Date(y, m - 1, 0).getDate()

    // 上月尾部
    for (let i = 0; i < startWeek; i++) {
        const d = new Date(y, m - 2, prevDays - startWeek + 1 + i)
        cells.push(dayCellFor(d, false))
    }
    // 本月
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push(dayCellFor(new Date(y, m - 1, d), true))
    }
    // 下月头部补齐到 42
    let nxt = 1
    while (cells.length < 42) {
        cells.push(dayCellFor(new Date(y, m, nxt++), false))
    }
    return cells
})

function dayCellFor(d: Date, inMonth: boolean): DayCell {
    const iso = isoDate(d)
    const matched = allActivities.value.filter(a =>
        startDateIso(a) === iso && !isHidden(a.articleId)
    )
    const types: string[] = []
    for (const a of matched) {
        const t = a.type || '活动'
        if (!types.includes(t) && types.length < 2) types.push(t)
    }
    return {
        iso,
        day: d.getDate(),
        inMonth,
        isToday: iso === todayIso,
        count: matched.length,
        types,
    }
}

// ==================== 选中日期的活动 ====================

const selectedActivities = computed(() =>
    allActivities.value
        .filter(a => startDateIso(a) === selectedDate.value && !isHidden(a.articleId))
        .sort((a, b) => (a.startAtEpoch || 0) - (b.startAtEpoch || 0))
)

const upcomingActivities = computed(() => {
    const now = Date.now()
    return allActivities.value
        .filter(a => (a.startAtEpoch || 0) >= now && !isHidden(a.articleId))
        .sort((a, b) => (a.startAtEpoch || 0) - (b.startAtEpoch || 0))
        .slice(0, 30)
})

const visiblePendingActivities = computed(() =>
    pendingActivities.value.filter(a => !isHidden(a.articleId))
)

// ==================== 加载 ====================

async function loadAll() {
    loading.value = true
    try {
        // 一次性拉 upcoming（includePast=true 覆盖近期历史 + 未来）
        const res = await activityApi.getUpcoming(100, true)
        allActivities.value = res || []
    } catch (e) {
        console.error('[Calendar] load upcoming failed', e)
    } finally {
        loading.value = false
    }
}

async function loadPending() {
    if (pendingActivities.value.length > 0) return  // 懒加载，已加载则跳过
    try {
        const res = await activityApi.getPending(30)
        pendingActivities.value = res || []
    } catch (e) {
        console.error('[Calendar] load pending failed', e)
    }
}

// ==================== 交互 ====================

function onPrevMonth() {
    let m = viewMonth.value - 1
    let y = viewYear.value
    if (m < 1) { m = 12; y -= 1 }
    viewMonth.value = m
    viewYear.value = y
}

function onNextMonth() {
    let m = viewMonth.value + 1
    let y = viewYear.value
    if (m > 12) { m = 1; y += 1 }
    viewMonth.value = m
    viewYear.value = y
}

function onGoToday() {
    const now = new Date()
    viewYear.value = now.getFullYear()
    viewMonth.value = now.getMonth() + 1
    selectedDate.value = todayIso
}

function onSelectDay(c: DayCell) {
    selectedDate.value = c.iso
    if (!c.inMonth) {
        // 点到邻月的日期，视图切到那个月
        const parts = c.iso.split('-').map(Number)
        viewYear.value = parts[0]
        viewMonth.value = parts[1]
    }
}

function onBottomTab(t: 'upcoming' | 'pending') {
    bottomTab.value = t
    if (t === 'pending') loadPending()
}

// 防抖：华为等真机 @tap 偶尔触发两次，导致页面栈进两次
let lastNavigateAt = 0
function canNavigate(): boolean {
    const now = Date.now()
    if (now - lastNavigateAt < 400) return false
    lastNavigateAt = now
    return true
}

function onOpenArticle(item: ActivityItem) {
    if (!canNavigate()) return
    // 统一跳公文详情页；detail 页内部自己处理站内/外链逻辑
    const ch = item.channelId || 'announcement'
    uni.navigateTo({
        url: `/pages/notice/detail?id=${item.articleId}&channelId=${ch}`,
        fail: () => {
            // 极端兜底：导航失败才复制原 URL
            if (item.articleUrl) {
                uni.setClipboardData({
                    data: item.articleUrl,
                    success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
                })
            }
        },
    })
}

// ==================== 报告错误 ====================

const REPORT_OPTIONS: { label: string; reason: ReportReason }[] = [
    { label: '这不是活动', reason: 'not_activity' },
    { label: '时间错了', reason: 'wrong_time' },
    { label: '标题不对', reason: 'wrong_title' },
    { label: '地点不对', reason: 'wrong_location' },
    { label: '其他问题', reason: 'other' },
]

let lastReportAt = 0
function onReport(item: ActivityItem, ev?: any) {
    // 阻止冒泡到卡片的 onOpenArticle
    if (ev && ev.stopPropagation) ev.stopPropagation()
    // 防抖，真机快速双击不会弹两次 action-sheet
    const now = Date.now()
    if (now - lastReportAt < 400) return
    lastReportAt = now
    uni.showActionSheet({
        alertText: '报告活动识别错误',
        itemList: REPORT_OPTIONS.map(o => o.label),
        success: async (res) => {
            const picked = REPORT_OPTIONS[res.tapIndex]
            if (!picked) return
            // 本地立即隐藏（B3 即时反馈），不影响其他用户
            hideLocally(item.articleId)
            try {
                await activityApi.report({
                    articleId: item.articleId,
                    channelId: item.channelId,
                    reason: picked.reason,
                    titleSnapshot: item.title,
                })
                uni.showToast({ title: '已隐藏并提交，感谢反馈', icon: 'success' })
            } catch (e: any) {
                // 即使提交失败，本地已隐藏；记 log 就行，不惊动用户
                console.error('[Calendar] report failed', e)
                uni.showToast({ title: '已本地隐藏', icon: 'success' })
            }
        },
    })
}

// ==================== 辅助 ====================

function isoDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function startDateIso(a: ActivityItem): string {
    if (!a.startAt) return ''
    return a.startAt.slice(0, 10)
}

function displayDate(iso: string): string {
    const parts = iso.split('-')
    return `${parseInt(parts[1])} 月 ${parseInt(parts[2])} 日`
}

function displayTime(a: ActivityItem): string {
    if (!a.startAt) return '时间待定'
    if (a.startAt.length >= 16 && a.startAt.includes('T')) {
        return a.startAt.slice(11, 16)
    }
    return '全天'
}

const WEEKS = ['日', '一', '二', '三', '四', '五', '六']

// ==================== 生命周期 ====================

onMounted(() => {
    loadAll()
})
</script>

<template>
    <view class="calendar-page">
        <!-- 顶部：月份导航 -->
        <view class="header">
            <view class="nav-btn" @tap="onPrevMonth">
                <t-icon name="chevron-left" size="40rpx" />
            </view>
            <view class="title">
                <text class="year-month">{{ viewYear }} 年 {{ viewMonth }} 月</text>
            </view>
            <view class="nav-btn" @tap="onNextMonth">
                <t-icon name="chevron-right" size="40rpx" />
            </view>
            <view class="today-btn" @tap="onGoToday">
                <text>今天</text>
            </view>
        </view>

        <!-- 星期表头 -->
        <view class="weekdays">
            <view v-for="w in WEEKS" :key="w" class="weekday">{{ w }}</view>
        </view>

        <!-- 月历网格 -->
        <view class="grid">
            <view
                v-for="c in grid"
                :key="c.iso"
                :class="[
                    'day-cell',
                    { 'is-today': c.isToday, 'is-dim': !c.inMonth, 'is-active': c.iso === selectedDate }
                ]"
                @tap="onSelectDay(c)"
            >
                <view class="day-num">{{ c.day }}</view>
                <view class="day-tags" v-if="c.count > 0">
                    <view
                        v-for="(t, i) in c.types"
                        :key="i"
                        class="day-tag"
                    >{{ t }}</view>
                    <view v-if="c.count > c.types.length" class="day-tag more">
                        +{{ c.count - c.types.length }}
                    </view>
                </view>
            </view>
        </view>

        <!-- 选中日期的活动 -->
        <view class="section selected">
            <view class="section-header">
                <view class="bar" />
                <text class="section-title">{{ displayDate(selectedDate) }}</text>
                <text class="section-count">{{ selectedActivities.length }} 个活动</text>
            </view>
            <view v-if="selectedActivities.length === 0" class="empty-inline">
                <text>该日暂无活动</text>
            </view>
            <view
                v-for="a in selectedActivities"
                :key="a.articleId"
                class="activity-card"
                @tap="onOpenArticle(a)"
            >
                <view class="card-time">{{ displayTime(a) }}</view>
                <view class="card-main">
                    <view class="card-title">{{ a.title }}</view>
                    <view class="card-meta">
                        <text v-if="a.type" class="meta-type">{{ a.type }}</text>
                        <text v-if="a.location" class="meta-location">· {{ a.location }}</text>
                    </view>
                    <view v-if="a.registration" class="card-registration">
                        报名：{{ a.registration }}
                    </view>
                </view>
                <view class="card-report" @tap.stop="onReport(a, $event)">
                    <t-icon name="more" size="32rpx" color="#bbb" />
                </view>
            </view>
        </view>

        <!-- 底部 tab：即将到来 / 时间待定 -->
        <view class="tabbar">
            <view
                :class="['tab-item', { active: bottomTab === 'upcoming' }]"
                @tap="onBottomTab('upcoming')"
            >即将到来</view>
            <view
                :class="['tab-item', { active: bottomTab === 'pending' }]"
                @tap="onBottomTab('pending')"
            >时间待定</view>
        </view>

        <view v-if="bottomTab === 'upcoming'" class="section upcoming-list">
            <view v-if="upcomingActivities.length === 0 && !loading" class="empty-inline">
                <text>暂无即将到来的活动</text>
            </view>
            <view
                v-for="a in upcomingActivities"
                :key="a.articleId"
                class="upcoming-card"
                @tap="onOpenArticle(a)"
            >
                <view class="up-date">
                    <text class="up-month">{{ a.startAt?.slice(5, 7) }}月</text>
                    <text class="up-day">{{ a.startAt?.slice(8, 10) }}</text>
                </view>
                <view class="up-main">
                    <text class="up-title">{{ a.title }}</text>
                    <view class="up-meta">
                        <text v-if="a.type" class="meta-type">{{ a.type }}</text>
                        <text v-if="a.location"> · {{ a.location }}</text>
                        <text v-if="a.startAt?.length >= 16"> · {{ displayTime(a) }}</text>
                    </view>
                </view>
                <view class="card-report" @tap.stop="onReport(a, $event)">
                    <t-icon name="more" size="32rpx" color="#bbb" />
                </view>
            </view>
        </view>

        <view v-else class="section pending-list">
            <view class="pending-hint">
                <t-icon name="info-circle" size="24rpx" color="#ff976a" />
                <text>这里的活动时间信息不充分，点卡片跳原文查看完整内容</text>
            </view>
            <view v-if="visiblePendingActivities.length === 0" class="empty-inline">
                <text>暂无时间待定活动</text>
            </view>
            <view
                v-for="a in visiblePendingActivities"
                :key="a.articleId"
                class="upcoming-card"
                @tap="onOpenArticle(a)"
            >
                <view class="up-date pending">
                    <text class="up-pending-label">待定</text>
                </view>
                <view class="up-main">
                    <text class="up-title">{{ a.title }}</text>
                    <view class="up-meta">
                        <text v-if="a.type" class="meta-type">{{ a.type }}</text>
                        <text v-if="a.registration"> · 报名：{{ a.registration }}</text>
                    </view>
                </view>
                <view class="card-report" @tap.stop="onReport(a, $event)">
                    <t-icon name="more" size="32rpx" color="#bbb" />
                </view>
            </view>
        </view>

        <view v-if="loading" class="loading-wrap">
            <t-loading theme="circular" size="60rpx" />
        </view>

        <view style="height: 60rpx;" />
    </view>
</template>

<style lang="scss" scoped>
.calendar-page {
    min-height: 100vh;
    background: #f5f5f5;
}

/* ==================== 顶部 ==================== */

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 32rpx;
    background: #fff;
    border-bottom: 1rpx solid #eee;
}

.nav-btn {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;

    &:active {
        color: #0052d9;
    }
}

.title {
    flex: 1;
    text-align: center;
}

.year-month {
    font-size: 34rpx;
    font-weight: 600;
    color: #333;
}

.today-btn {
    padding: 8rpx 20rpx;
    background: #e6f0ff;
    color: #0052d9;
    font-size: 24rpx;
    border-radius: 20rpx;
    margin-left: 16rpx;

    &:active {
        background: #d0e0ff;
    }
}

/* ==================== 星期表头 ==================== */

.weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #fff;
    padding: 12rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
}

.weekday {
    text-align: center;
    font-size: 24rpx;
    color: #999;
}

/* ==================== 月历网格 ==================== */

.grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #fff;
    padding: 8rpx;
}

.day-cell {
    min-height: 120rpx;
    padding: 6rpx 4rpx;
    border-radius: 8rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;

    &.is-dim {
        opacity: 0.35;
    }

    &.is-active {
        background: #e6f0ff;
    }

    &.is-today .day-num {
        background: #0052d9;
        color: #fff;
        border-radius: 50%;
    }

    &:active {
        background: #f0f0f0;
    }
}

.day-num {
    width: 44rpx;
    height: 44rpx;
    line-height: 44rpx;
    text-align: center;
    font-size: 28rpx;
    color: #333;
}

.day-tags {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rpx;
    width: 100%;
    padding: 0 2rpx;
}

.day-tag {
    font-size: 18rpx;
    color: #0052d9;
    background: #e6f0ff;
    padding: 2rpx 6rpx;
    border-radius: 4rpx;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;

    &.more {
        color: #666;
        background: #f0f0f0;
    }
}

/* ==================== 选中日期 ==================== */

.section {
    margin: 24rpx 20rpx;
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
}

.section-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 16rpx;
}

.bar {
    width: 6rpx;
    height: 28rpx;
    background: #0052d9;
    border-radius: 3rpx;
}

.section-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
    flex: 1;
}

.section-count {
    font-size: 24rpx;
    color: #999;
}

.empty-inline {
    padding: 40rpx 0;
    text-align: center;
    color: #bbb;
    font-size: 26rpx;
}

.activity-card {
    display: flex;
    gap: 16rpx;
    padding: 20rpx 0;
    border-top: 1rpx solid #f5f5f5;

    &:first-child {
        border-top: none;
    }

    &:active {
        background: #f9f9f9;
    }
}

.card-time {
    flex-shrink: 0;
    font-size: 26rpx;
    color: #0052d9;
    font-weight: 600;
    min-width: 100rpx;
}

.card-main {
    flex: 1;
    min-width: 0;
}

.card-title {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
    line-height: 1.4;
    margin-bottom: 8rpx;
}

.card-meta {
    font-size: 22rpx;
    color: #999;
    margin-bottom: 6rpx;
}

.meta-type {
    color: #0052d9;
    padding: 2rpx 8rpx;
    background: #e6f0ff;
    border-radius: 4rpx;
    margin-right: 6rpx;
}

.meta-location {
    color: #666;
}

.card-registration {
    font-size: 22rpx;
    color: #ff976a;
    margin-top: 4rpx;
}

/* 报告错误按钮（⋯）—— 右上角，点击不触发卡片打开 */
.card-report {
    flex-shrink: 0;
    padding: 4rpx 8rpx;
    margin-left: 12rpx;
    opacity: 0.6;

    &:active {
        opacity: 1;
        background: #f0f0f0;
        border-radius: 50%;
    }
}

/* ==================== 底部 tab ==================== */

.tabbar {
    display: flex;
    justify-content: center;
    background: #fff;
    margin: 0 20rpx;
    border-radius: 16rpx 16rpx 0 0;
    border-bottom: 1rpx solid #eee;
}

.tab-item {
    padding: 20rpx 40rpx;
    font-size: 28rpx;
    color: #666;
    position: relative;

    &.active {
        color: #0052d9;
        font-weight: 600;

        &::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 48rpx;
            height: 4rpx;
            background: #0052d9;
            border-radius: 2rpx;
        }
    }
}

.upcoming-list,
.pending-list {
    margin-top: 0;
    border-radius: 0 0 16rpx 16rpx;
}

/* 时间待定 tab 顶部提示条 —— 引导跳原文 */
.pending-hint {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 12rpx 16rpx;
    margin-bottom: 12rpx;
    background: #fff7e6;
    color: #d46b08;
    border-radius: 8rpx;
    font-size: 22rpx;
}

.upcoming-card {
    display: flex;
    gap: 20rpx;
    padding: 20rpx 0;
    border-top: 1rpx solid #f5f5f5;

    &:first-child {
        border-top: none;
    }

    &:active {
        background: #f9f9f9;
    }
}

.up-date {
    flex-shrink: 0;
    width: 90rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #e6f0ff;
    border-radius: 8rpx;
    padding: 12rpx 0;

    &.pending {
        background: #fff3e0;
    }
}

.up-month {
    font-size: 20rpx;
    color: #0052d9;
}

.up-day {
    font-size: 32rpx;
    font-weight: 600;
    color: #0052d9;
}

.up-pending-label {
    font-size: 22rpx;
    color: #f57c00;
    font-weight: 500;
}

.up-main {
    flex: 1;
    min-width: 0;
}

.up-title {
    font-size: 28rpx;
    color: #333;
    line-height: 1.4;
    display: block;
    margin-bottom: 6rpx;
}

.up-meta {
    font-size: 22rpx;
    color: #999;
}

.loading-wrap {
    display: flex;
    justify-content: center;
    padding: 40rpx 0;
}
</style>
