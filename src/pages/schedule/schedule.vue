<!--
  课表页面

  文件：src/pages/schedule/schedule.vue

  布局：
  - 顶部：学期选择 + 周次选择 + 刷新
  - 中部：课表网格（左侧时间列固定，右侧7天横向滑动）
  - 底部：课程详情弹窗（点击课程卡片弹出）

  后端 row 映射（CrouseParser 解析 #timetable 表格）：
  row 0 = 表头（无数据），row 1-7 = 实际课表行
-->

<template>
  <PageLayout>
    <view class="schedule-page">
      <!-- 顶部控制栏 -->
      <view :class="['control-bar', { disabled: !isLoggedIn }]">
        <view class="semester-btn" @tap="isLoggedIn && (showSemesterInput = !showSemesterInput)">
          <t-icon name="calendar" size="28rpx" />
          <text>{{ currentSemester || '选择学期' }}</text>
        </view>
        <view class="week-btn" @tap="isLoggedIn && (showWeekPicker = !showWeekPicker)">
          <text>第 {{ currentWeek }} 周</text>
          <t-icon name="chevron-down" size="24rpx" />
        </view>
        <view class="refresh-btn" @tap="isLoggedIn && handleRefresh()">
          <t-icon name="refresh" size="32rpx" />
        </view>
      </view>

      <!-- 学期选择面板（自动生成学期列表） -->
      <view v-if="isLoggedIn && showSemesterInput" class="semester-panel">
        <scroll-view scroll-y class="semester-scroll">
          <view v-for="sem in semesterList" :key="sem"
            :class="['semester-item', { active: currentSemester === sem }]"
            @tap="handleSemesterChange(sem)">
            {{ sem }}
          </view>
        </scroll-view>
      </view>

      <!-- 周次快速选择（根据学期类型限制数量） -->
      <view v-if="isLoggedIn && showWeekPicker" class="week-picker">
        <view v-for="w in maxWeeks" :key="w"
          :class="['week-item', { active: currentWeek === w }]"
          @tap="handleWeekChange(w)">
          {{ w }}
        </view>
      </view>

      <!-- 未登录空态：灰色框架 + "去登录" -->
      <view v-if="!isLoggedIn" class="state-wrap">
        <t-icon name="calendar-2" size="80rpx" color="#ccc" />
        <text class="state-text">登录后可查看课表</text>
        <view class="login-hint-btn" @tap="goLogin">去登录</view>
      </view>

      <!-- 加载 -->
      <view v-else-if="loading" class="state-wrap">
        <t-loading theme="circular" size="80rpx" />
        <text class="state-text">正在获取课表...</text>
      </view>

      <!-- 错误 -->
      <view v-else-if="error" class="state-wrap">
        <t-icon name="close-circle" size="80rpx" color="#fa5151" />
        <text class="state-text">{{ error }}</text>
        <t-button theme="primary" size="small" @click="handleRefresh">重试</t-button>
      </view>

      <!--
        课表 2D 画布
        ======================================================================
        · 单个 scroll-view 双轴（scroll-x + scroll-y），用户可横纵自由拖
        · 画布按 5min = 15rpx 的刻度绘制；所有元素（时间列 / 日期头 / 课程卡）
          都按绝对定位，一起跟画布滚动
        · ⚠️ 不用 position: sticky —— 微信小程序的 scroll-view 是 native scroller，
          CSS sticky 在内部被当成 static，贴不住，会被打回 DOM 流顶部。
        · 今日列半透明蓝色底、休息时间留白比例 = 真实分钟比例
      -->
      <view v-else class="canvas-wrap">
        <scroll-view class="canvas-scroll" scroll-x scroll-y :enhanced="true"
          :show-scrollbar="false" :bounces="true">
          <view class="canvas" :style="{ width: canvasWidthRpx + 'rpx', height: canvasHeightRpx + 'rpx' }">

            <!-- 左上角（absolute top-left，画布内固定角）-->
            <view class="corner"
              :style="{ width: TIME_COL_RPX + 'rpx', height: HEADER_H_RPX + 'rpx' }" />

            <!-- 日期表头（absolute，顶部一排）-->
            <view class="day-header"
              :style="{ left: TIME_COL_RPX + 'rpx', top: 0,
                        width: (canvasWidthRpx - TIME_COL_RPX) + 'rpx',
                        height: HEADER_H_RPX + 'rpx' }">
              <view v-for="(day, idx) in weekDays" :key="idx"
                class="day-cell" :class="{ today: isToday(idx) }"
                :style="{ width: DAY_WIDTH_RPX + 'rpx' }">
                <text class="day-name">{{ day.label }}</text>
                <text class="day-date">{{ day.date }}</text>
              </view>
            </view>

            <!-- 时间列（absolute，左侧一列，内部 slot label 再按 startMin 绝对定位）-->
            <view class="time-col"
              :style="{ left: 0, top: HEADER_H_RPX + 'rpx',
                        width: TIME_COL_RPX + 'rpx',
                        height: (canvasHeightRpx - HEADER_H_RPX) + 'rpx' }">
              <view v-for="slot in SZTU_TIME_TABLE" :key="slot.slot"
                class="time-slot"
                :style="{ top: ((slot.startMin - DAY_START_MIN) / 5 * CELL_UNIT_RPX) + 'rpx',
                          height: ((slot.endMin - slot.startMin) / 5 * CELL_UNIT_RPX) + 'rpx' }">
                <text class="slot-label">{{ slot.label }}</text>
                <text class="slot-time">{{ fmt(slot.startMin) }}-{{ fmt(slot.endMin) }}</text>
              </view>
            </view>

            <!-- 今日列背景（绝对定位，z-index 0 垫底）-->
            <view v-if="todayCol >= 0" class="today-hint"
              :style="{ left: (TIME_COL_RPX + todayCol * DAY_WIDTH_RPX) + 'rpx',
                        top: HEADER_H_RPX + 'rpx',
                        width: DAY_WIDTH_RPX + 'rpx',
                        height: (canvasHeightRpx - HEADER_H_RPX) + 'rpx' }" />

            <!-- 节次之间的横向分隔线（只画 slot 的 end 那一条，画在课程卡下面）-->
            <view v-for="slot in SZTU_TIME_TABLE" :key="'div-' + slot.slot"
              class="slot-divider"
              :style="{ top: yOfMin(slot.endMin) + 'rpx',
                        left: TIME_COL_RPX + 'rpx',
                        width: (canvasWidthRpx - TIME_COL_RPX) + 'rpx' }" />

            <!-- 课程卡（绝对定位，z-index 1）-->
            <view v-for="(c, i) in positionedCourses" :key="c.course.courseId + '-' + i"
              class="course-card"
              :style="c.cardStyle"
              @tap="handleCourseTap(c.course)">
              <text class="card-name">{{ c.course.courseName }}</text>
              <text class="card-location">{{ c.course.location }}</text>
            </view>

          </view>
        </scroll-view>

        <!-- 无课提示 -->
        <view v-if="courses.length === 0" class="empty-hint">
          <text>本学期暂无课程数据</text>
        </view>
      </view>

      <!-- 课程详情弹窗 -->
      <t-popup :visible="showDetail" placement="bottom" @visible-change="(e: any) => { if (!extractBoolean(e)) showDetail = false }">
        <view v-if="selectedCourse" class="detail-popup">
          <view class="detail-header">
            <text class="detail-title">{{ selectedCourse.courseName }}</text>
            <view @tap="showDetail = false"><t-icon name="close" size="40rpx" /></view>
          </view>
          <view class="detail-item">
            <t-icon name="user" size="32rpx" color="#666" />
            <text>{{ selectedCourse.teacher || '未知' }}</text>
          </view>
          <view class="detail-item">
            <t-icon name="location" size="32rpx" color="#666" />
            <text>{{ selectedCourse.location || '未知' }}</text>
          </view>
          <view class="detail-item">
            <t-icon name="time" size="32rpx" color="#666" />
            <text>{{ selectedCourse.courseTime }}</text>
          </view>
          <view class="detail-item">
            <t-icon name="calendar" size="32rpx" color="#666" />
            <text>{{ selectedCourse.courseWeeks }} 周</text>
          </view>
        </view>
      </t-popup>
    </view>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useUserStore } from '@/store/modules/user'
import { useInfoStore } from '@/store/modules/info'
import { useSchedule, type CourseInfo, SZTU_TIME_TABLE, parseCourseTime, fmtMinutes } from '@/hooks/useSchedule'
import { extractBoolean } from '@/utils/tdesign'

const { ensure } = useAuthGuard()
const userStore = useUserStore()
const infoStore = useInfoStore()
const {
    courses, currentWeek, currentSemester, loading, error,
    weekDays, fetchSchedule, getCourseColor, isToday,
} = useSchedule()

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)

function goLogin() {
    uni.navigateTo({ url: '/pages/common/login/login' })
}

// ==================== 学期自动生成 ====================

/** 生成学期列表：从当前年份倒推到 2017 */
const semesterList = computed(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const list: string[] = []
    for (let year = currentYear; year >= 2017; year--) {
        list.push(`${year}-${year + 1}-3`)
        list.push(`${year}-${year + 1}-2`)
        list.push(`${year}-${year + 1}-1`)
    }
    return list
})

/** 周次上限：第3学期（暑期）最多10周，普通学期22周 */
const maxWeeks = computed(() => {
    if (currentSemester.value && currentSemester.value.endsWith('-3')) {
        return 10
    }
    return 22
})

// ==================== 画布常量（2D canvas 版，见 useSchedule.ts 头部说明） ====================

/** 5min = 15rpx（基本刻度单位） */
const CELL_UNIT_RPX = 15
/** 日窗口 07:00 - 23:00（足够覆盖任何课程时间，含早晚缓冲） */
const DAY_START_MIN = 7 * 60
const DAY_END_MIN = 23 * 60
/** 每一天列宽 */
const DAY_WIDTH_RPX = 200
/** 左侧时间列宽（要塞得下"第十一、十二节 19:00-20:20"）*/
const TIME_COL_RPX = 140
/** 顶部日期头高 */
const HEADER_H_RPX = 88

/** 画布总高 = 头 + (23:00 - 07:00) / 5 * 15rpx = 88 + 16*12*15 = 88 + 2880 = 2968 */
const canvasHeightRpx = HEADER_H_RPX + (DAY_END_MIN - DAY_START_MIN) / 5 * CELL_UNIT_RPX
/** 画布总宽 = 时间列 + 7 * 日列宽 = 140 + 1400 = 1540 */
const canvasWidthRpx = TIME_COL_RPX + 7 * DAY_WIDTH_RPX

// ==================== 本地状态 ====================

const showSemesterInput = ref(false)
const showWeekPicker = ref(false)
const showDetail = ref(false)
const selectedCourse = ref<CourseInfo | null>(null)

// ==================== 坐标工具 ====================

/** 分钟数 → 画布上的 y 坐标（rpx），自动 clamp 到 [DAY_START, DAY_END] */
function yOfMin(min: number): number {
    const clamped = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, min))
    return HEADER_H_RPX + (clamped - DAY_START_MIN) / 5 * CELL_UNIT_RPX
}

/** 分钟数 → "HH:MM" */
const fmt = fmtMinutes

/** 今日列 index（0=周一 ... 6=周日），非今天返回 -1 */
const todayCol = computed<number>(() => {
    const wd = new Date().getDay()   // 0=Sun, 1=Mon ...
    return wd === 0 ? 6 : wd - 1
})

// ==================== 课程定位 ====================

interface PositionedCourse {
    course: CourseInfo
    cardStyle: Record<string, string>
}

/** 把 courses 扁平展开成带绝对定位 style 的数组（画布直接 v-for）*/
const positionedCourses = computed<PositionedCourse[]>(() => {
    const out: PositionedCourse[] = []
    for (const c of courses.value) {
        const t = parseCourseTime(c.courseTime)
        if (!t) {
            // courseTime 无法解析就跳过（极少数空字符串场景）
            continue
        }
        if (t.endMin < DAY_START_MIN || t.startMin > DAY_END_MIN) {
            // 完全在窗外的课（不可能，但防御）
            continue
        }
        const color = getCourseColor(c.courseName)
        const top = yOfMin(t.startMin)
        const height = (Math.min(t.endMin, DAY_END_MIN) - Math.max(t.startMin, DAY_START_MIN)) / 5 * CELL_UNIT_RPX
        const left = TIME_COL_RPX + c.col * DAY_WIDTH_RPX
        out.push({
            course: c,
            cardStyle: {
                top: `${top}rpx`,
                height: `${height}rpx`,
                left: `${left}rpx`,
                width: `${DAY_WIDTH_RPX}rpx`,
                backgroundColor: color.bg,
                color: color.text,
                borderLeft: `6rpx solid ${color.text}`,
            }
        })
    }
    return out
})

// ==================== 事件处理 ====================

function handleCourseTap(course: CourseInfo) {
    selectedCourse.value = course
    showDetail.value = true
}

async function handleRefresh() {
    await fetchSchedule()
}

async function handleSemesterChange(semester: string) {
    currentSemester.value = semester
    currentWeek.value = 1 // 切换学期时重置为第1周
    showSemesterInput.value = false
    await fetchSchedule('1', semester)
}

async function handleWeekChange(week: number) {
    currentWeek.value = week
    showWeekPicker.value = false
    await fetchSchedule(String(week), currentSemester.value || undefined)
}

// ==================== 生命周期 ====================

onShow(async () => {
    // 课表是"软"登录：未登录也展示页面框架，引导用户去登录，不再强制跳转
    const result = await ensure({ requireSchoolLogin: false })
    if (result.success && result.logined && courses.value.length === 0) {
        await fetchSchedule()
    }
    // 校准 TabBar 徽章（detail 等非 tabBar 页期间的改动会 stale）
    infoStore.syncTabBarBadge()
})
</script>

<style lang="scss" scoped>
// ==================== 控制栏 ====================

.control-bar {
    display: flex;
    align-items: center;
    padding: 16rpx 20rpx;
    background: #fff;
    gap: 12rpx;
    border-bottom: 1rpx solid #eee;

    &.disabled {
        opacity: 0.55;
        pointer-events: none;

        .semester-btn,
        .week-btn {
            background: #f0f0f0;
            color: #999;
        }

        .refresh-btn {
            color: #bbb;
        }
    }
}

.semester-btn, .week-btn {
    display: flex;
    align-items: center;
    gap: 6rpx;
    padding: 10rpx 16rpx;
    background: #e3f2fd;
    border-radius: 20rpx;
    font-size: 24rpx;
    color: #1565c0;
    flex-shrink: 0;
}

.refresh-btn {
    margin-left: auto;
    padding: 10rpx;
    color: #666;
}

// ==================== 学期选择面板 ====================

.semester-panel {
    background: #fff;
    border-bottom: 1rpx solid #eee;
}

.semester-scroll {
    max-height: 500rpx;
    padding: 8rpx 0;
}

.semester-item {
    padding: 20rpx 32rpx;
    font-size: 28rpx;
    color: #333;
    border-bottom: 1rpx solid #f5f5f5;

    &.active {
        color: #1565c0;
        font-weight: 600;
        background: #e3f2fd;
    }

    &:active {
        background: #f0f0f0;
    }
}

// ==================== 周次选择 ====================

.week-picker {
    display: flex;
    flex-wrap: wrap;
    padding: 12rpx 20rpx;
    background: #fff;
    border-bottom: 1rpx solid #eee;
    gap: 10rpx;
}

.week-item {
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 24rpx;
    color: #333;
    background: #f5f5f5;

    &.active {
        background: #1565c0;
        color: #fff;
    }
}

// ==================== 加载/错误 ====================

.state-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 100rpx 0;
    gap: 20rpx;
}

.state-text {
    font-size: 26rpx;
    color: #999;
}

/* 未登录空态的"去登录"按钮：灰底柔和风格 */
.login-hint-btn {
    margin-top: 8rpx;
    padding: 16rpx 56rpx;
    background: #f0f0f0;
    color: #666;
    font-size: 26rpx;
    border-radius: 999rpx;

    &:active {
        background: #e0e0e0;
    }
}

// ==================== 课表 2D 画布 ====================
//
// 布局策略（2026-04 修订）：
//   · 外层 scroll-view 开双轴 scroll（scroll-x + scroll-y）
//   · 画布内**全部绝对定位**：corner / day-header / time-col / course-card / today-hint
//   · ⚠️ 不使用 position: sticky —— 微信小程序的 scroll-view 内部是 native
//     scroller，CSS sticky 无法定位（会被打回 DOM 流顶部，破坏布局）
//   · 所以日期头和时间列会跟着画布一起滚——这是 scroll-view 架构的妥协，
//     用户滚回顶/左即可重新看见刻度
//   · z-index 分层：底 today-hint/divider(0) → 中 course-card(1) →
//     上 day-header/time-col(2) → 最上 corner(3)

// .schedule-page 改成 flex column，让 canvas-wrap 能拿到实际像素高度
.schedule-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: #f5f5f5;
}

.canvas-wrap {
    background: #fff;
    margin: 12rpx;
    border-radius: 12rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
    // flex:1 + min-height:0 —— 让 scroll-view 真的能在剩余空间里纵向滚，
    // 不用 calc(100vh - N rpx)（rpx/vh 混算在部分设备上结果诡异）
    flex: 1;
    min-height: 0;
}

.canvas-scroll {
    width: 100%;
    height: 100%;
    white-space: nowrap;    // 小程序 scroll-x 必须
}

.canvas {
    position: relative;
    background: #fff;
}

// ---- 左上角（绝对定位到 (0, 0)）----
.corner {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 3;
    background: #f0f2f5;
    border-right: 1rpx solid #e0e0e0;
    border-bottom: 2rpx solid #e0e0e0;
}

// ---- 日期表头（绝对定位到顶部一排）----
.day-header {
    position: absolute;
    z-index: 2;
    display: flex;
    background: #f0f2f5;
    border-bottom: 2rpx solid #e0e0e0;
}

.day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
    border-right: 1rpx solid #e8e8e8;
    flex-shrink: 0;
    height: 100%;

    &.today {
        background: #e3f2fd;
        .day-name { color: #1565c0; font-weight: bold; }
    }
}

.day-name {
    font-size: 36rpx;
    color: #333;
}

.day-date {
    font-size: 26rpx;
    color: #999;
    margin-top: 4rpx;
}

// ---- 时间列（绝对定位到左侧一列，内部 .time-slot 按 slot startMin 再绝对定位）----
.time-col {
    position: absolute;
    z-index: 2;
    background: #fafafa;
    border-right: 1rpx solid #e0e0e0;
}

.time-slot {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rpx;
    box-sizing: border-box;
}

.slot-label {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    text-align: center;
}

.slot-time {
    font-size: 22rpx;
    color: #999;
    text-align: center;
    line-height: 1.3;
    margin-top: 4rpx;
}

// ---- 今日列高亮（绝对定位，z-index 0 垫底）----
.today-hint {
    position: absolute;
    background: rgba(21, 101, 192, 0.06);
    pointer-events: none;
    z-index: 0;
}

// ---- 节次分隔横线（画在 slot endMin 处）----
.slot-divider {
    position: absolute;
    height: 1rpx;
    background: #eee;
    pointer-events: none;
    z-index: 0;
}

// ---- 课程卡（绝对定位，z-index 1）----
.course-card {
    position: absolute;
    z-index: 1;
    border-radius: 10rpx;
    padding: 10rpx 12rpx;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    box-sizing: border-box;
    // 给卡片和相邻卡之间一个呼吸
    margin: 2rpx;
}

.card-name {
    font-size: 32rpx;
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
    white-space: normal;      // 抵消外层 .canvas-scroll 的 nowrap
}

.card-location {
    font-size: 26rpx;
    opacity: 0.85;
    margin-top: 6rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

// 空状态
.empty-hint {
    text-align: center;
    padding: 40rpx;
    font-size: 26rpx;
    color: #999;
}

// ==================== 课程详情弹窗 ====================

.detail-popup {
    padding: 32rpx;
    background: #fff;
    border-radius: 24rpx 24rpx 0 0;
    padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24rpx;
}

.detail-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #333;
    flex: 1;
}

.detail-item {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 16rpx 0;
    font-size: 28rpx;
    color: #666;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child { border-bottom: none; }
}
</style>
