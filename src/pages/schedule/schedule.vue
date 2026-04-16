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
      <view class="control-bar">
        <view class="semester-btn" @tap="showSemesterInput = !showSemesterInput">
          <t-icon name="calendar" size="28rpx" />
          <text>{{ currentSemester || '选择学期' }}</text>
        </view>
        <view class="week-btn" @tap="showWeekPicker = !showWeekPicker">
          <text>第 {{ currentWeek }} 周</text>
          <t-icon name="chevron-down" size="24rpx" />
        </view>
        <view class="refresh-btn" @tap="handleRefresh">
          <t-icon name="refresh" size="32rpx" />
        </view>
      </view>

      <!-- 学期输入面板 -->
      <view v-if="showSemesterInput" class="input-panel">
        <view class="input-row">
          <text class="input-label">学期</text>
          <t-input :value="semesterInput" placeholder="如 2025-2026-2"
            @change="(e: any) => semesterInput = extractString(e)" />
        </view>
        <t-button theme="primary" size="small" block @click="handleQuery">查询</t-button>
      </view>

      <!-- 周次快速选择 -->
      <view v-if="showWeekPicker" class="week-picker">
        <view v-for="w in 25" :key="w"
          :class="['week-item', { active: currentWeek === w }]"
          @tap="handleWeekChange(w)">
          {{ w }}
        </view>
      </view>

      <!-- 加载 -->
      <view v-if="loading" class="state-wrap">
        <t-loading theme="circular" size="80rpx" />
        <text class="state-text">正在获取课表...</text>
      </view>

      <!-- 错误 -->
      <view v-else-if="error" class="state-wrap">
        <t-icon name="close-circle" size="80rpx" color="#fa5151" />
        <text class="state-text">{{ error }}</text>
        <t-button theme="primary" size="small" @click="handleRefresh">重试</t-button>
      </view>

      <!-- 课表网格 -->
      <view v-else class="grid-container">
        <!-- 星期表头 -->
        <view class="grid-header">
          <view class="time-col-header"></view>
          <scroll-view scroll-x class="days-scroll" :scroll-left="scrollLeft"
            @scroll="(e: any) => scrollLeft = e.detail.scrollLeft">
            <view class="days-row">
              <view v-for="(day, idx) in weekDays" :key="idx"
                :class="['day-cell', { today: isToday(idx) }]">
                <text class="day-name">{{ day.label }}</text>
                <text class="day-date">{{ day.date }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <!-- 课表主体（时间列 + 课程网格） -->
        <view class="grid-body">
          <!-- 左侧固定时间列 -->
          <view class="time-column">
            <view v-for="slot in ROW_CONFIG" :key="slot.row" class="time-cell"
              :style="{ height: slot.height + 'rpx' }">
              <text class="slot-label">{{ slot.label }}</text>
              <text class="slot-time">{{ slot.time }}</text>
            </view>
          </view>

          <!-- 右侧可滑动课程网格 -->
          <scroll-view scroll-x class="courses-scroll" :scroll-left="scrollLeft"
            @scroll="(e: any) => scrollLeft = e.detail.scrollLeft">
            <view class="courses-grid">
              <view v-for="slot in ROW_CONFIG" :key="slot.row" class="course-row"
                :style="{ height: slot.height + 'rpx' }">
                <view v-for="dayIdx in 7" :key="dayIdx" class="course-cell">
                  <!-- 渲染该位置的课程 -->
                  <view v-if="getCourseAt(slot.row, dayIdx - 1)"
                    class="course-card"
                    :style="cardStyle(getCourseAt(slot.row, dayIdx - 1)!)"
                    @tap="handleCourseTap(getCourseAt(slot.row, dayIdx - 1)!)">
                    <text class="card-name">{{ getCourseAt(slot.row, dayIdx - 1)!.courseName }}</text>
                    <text class="card-location">{{ getCourseAt(slot.row, dayIdx - 1)!.location }}</text>
                  </view>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>

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
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSchedule, type CourseInfo } from '@/hooks/useSchedule'
import { extractString, extractBoolean } from '@/utils/tdesign'

const { ensure } = useAuthGuard()
const {
    courses, currentWeek, currentSemester, loading, error,
    weekDays, fetchSchedule, getCourseColor, isToday,
} = useSchedule()

// ==================== 课表行配置（对应后端 CrouseParser 的 rowIndex） ====================

/**
 * 后端解析 #timetable 表格时 rowIndex 的映射：
 * row 0 = 表头（无数据），row 1-6 = 实际课表行，row 7 = 大课间
 *
 * 教务系统的表格行：
 * 第一二节 (01,02) 08:30-10:00
 * 第三四节 (03,04) 10:20-11:50
 * 第五六节 (05,06) 14:00-15:30
 * 第七八节 (07,08) 15:50-17:20
 * 第九十节 (09,10) 18:50-20:10   ← 注意是晚上
 * 第十一十二节 (11,12) 20:20-21:40
 * 大课间 (13,14) 17:30-18:49     ← 穿插在第七八节之后
 */
const ROW_CONFIG = [
    { row: 1, label: '1-2节', time: '8:30\n10:00', height: 180, period: '上午' },
    { row: 2, label: '3-4节', time: '10:20\n11:50', height: 180, period: '上午' },
    { row: 3, label: '5-6节', time: '14:00\n15:30', height: 180, period: '下午' },
    { row: 4, label: '7-8节', time: '15:50\n17:20', height: 180, period: '下午' },
    { row: 7, label: '大课间', time: '17:30\n18:49', height: 140, period: '傍晚' },
    { row: 5, label: '9-10节', time: '18:50\n20:10', height: 180, period: '晚上' },
    { row: 6, label: '11-12节', time: '20:20\n21:40', height: 180, period: '晚上' },
]

// ==================== 本地状态 ====================

const showSemesterInput = ref(false)
const showWeekPicker = ref(false)
const showDetail = ref(false)
const selectedCourse = ref<CourseInfo | null>(null)
const semesterInput = ref('')
const scrollLeft = ref(0)

// ==================== 课程查找 ====================

function getCourseAt(row: number, col: number): CourseInfo | null {
    return courses.value.find(c => c.row === row && c.col === col) || null
}

function cardStyle(course: CourseInfo) {
    const color = getCourseColor(course.courseName)
    return {
        backgroundColor: color.bg,
        color: color.text,
        borderLeft: `6rpx solid ${color.text}`,
    }
}

// ==================== 事件处理 ====================

function handleCourseTap(course: CourseInfo) {
    selectedCourse.value = course
    showDetail.value = true
}

async function handleRefresh() {
    await fetchSchedule()
}

async function handleQuery() {
    const semester = semesterInput.value || undefined
    if (semester) currentSemester.value = semester
    showSemesterInput.value = false
    await fetchSchedule(undefined, semester)
}

async function handleWeekChange(week: number) {
    currentWeek.value = week
    showWeekPicker.value = false
    await fetchSchedule(String(week), currentSemester.value || undefined)
}

// ==================== 生命周期 ====================

onShow(async () => {
    const result = await ensure({ requireSchoolLogin: true })
    if (result.success && result.logined && courses.value.length === 0) {
        await fetchSchedule()
    }
})
</script>

<style lang="scss" scoped>
.schedule-page {
    min-height: 100vh;
    background: #f5f5f5;
}

// ==================== 控制栏 ====================

.control-bar {
    display: flex;
    align-items: center;
    padding: 16rpx 20rpx;
    background: #fff;
    gap: 12rpx;
    border-bottom: 1rpx solid #eee;
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

// ==================== 输入面板 ====================

.input-panel {
    padding: 16rpx 20rpx;
    background: #fff;
    border-bottom: 1rpx solid #eee;
}

.input-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 12rpx;
}

.input-label {
    font-size: 24rpx;
    color: #666;
    width: 60rpx;
    flex-shrink: 0;
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

// ==================== 课表网格 ====================

.grid-container {
    background: #fff;
    margin: 12rpx;
    border-radius: 12rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

// 表头
.grid-header {
    display: flex;
    border-bottom: 2rpx solid #e0e0e0;
}

.time-col-header {
    width: 100rpx;
    height: 80rpx;
    flex-shrink: 0;
    background: #f0f2f5;
    border-right: 1rpx solid #e0e0e0;
}

.days-scroll {
    flex: 1;
    white-space: nowrap;
}

.days-row {
    display: flex;
    width: 700rpx; // 7天 × 100rpx
}

.day-cell {
    width: 100rpx;
    height: 80rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
    border-right: 1rpx solid #e8e8e8;
    flex-shrink: 0;

    &.today {
        background: #e3f2fd;
        .day-name { color: #1565c0; font-weight: bold; }
    }
}

.day-name {
    font-size: 24rpx;
    color: #333;
}

.day-date {
    font-size: 18rpx;
    color: #999;
}

// 主体
.grid-body {
    display: flex;
}

.time-column {
    width: 100rpx;
    flex-shrink: 0;
}

.time-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #fafafa;
    border-right: 1rpx solid #e0e0e0;
    border-bottom: 1rpx solid #e8e8e8;
    padding: 4rpx;
}

.slot-label {
    font-size: 20rpx;
    font-weight: 600;
    color: #333;
    text-align: center;
}

.slot-time {
    font-size: 16rpx;
    color: #999;
    text-align: center;
    white-space: pre-line;
    line-height: 1.3;
    margin-top: 4rpx;
}

// 课程滚动区
.courses-scroll {
    flex: 1;
    white-space: nowrap;
}

.courses-grid {
    width: 700rpx;
}

.course-row {
    display: flex;
    border-bottom: 1rpx solid #e8e8e8;
}

.course-cell {
    width: 100rpx;
    flex-shrink: 0;
    padding: 4rpx;
    border-right: 1rpx solid #f0f0f0;
    box-sizing: border-box;
}

// 课程卡片
.course-card {
    width: 100%;
    height: 100%;
    border-radius: 8rpx;
    padding: 6rpx 4rpx;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    box-sizing: border-box;
}

.card-name {
    font-size: 18rpx;
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
}

.card-location {
    font-size: 16rpx;
    opacity: 0.8;
    margin-top: 4rpx;
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
