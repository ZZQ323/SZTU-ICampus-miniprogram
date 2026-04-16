<!--
  课表页面（调试骨架版）

  文件：src/pages/schedule/schedule.vue

  当前状态：
  - 显示返回数据的 JSON 格式（调试用）
  - 学期/周次选择按钮可用
  - 课表网格骨架注释掉，等数据验证后再启用
-->

<template>
  <PageLayout>
    <view class="schedule-page">
      <!-- 顶部控制栏 -->
      <view class="control-bar">
        <view class="semester-selector" @tap="showSemesterInput = !showSemesterInput">
          <t-icon name="calendar" size="32rpx" />
          <text>{{ currentSemester || '当前学期' }}</text>
          <t-icon name="chevron-down" size="24rpx" />
        </view>

        <view class="week-selector" @tap="showWeekPicker = !showWeekPicker">
          <text>第 {{ currentWeek }} 周</text>
          <t-icon name="chevron-down" size="24rpx" />
        </view>

        <view class="refresh-btn" @tap="handleRefresh">
          <t-icon name="refresh" size="36rpx" :class="{ spinning: loading }" />
        </view>
      </view>

      <!-- 学期输入（展开时显示） -->
      <view v-if="showSemesterInput" class="input-panel">
        <view class="input-row">
          <text class="input-label">学期</text>
          <t-input
            :value="semesterInput"
            placeholder="如 2025-2026-2"
            @change="(e: any) => semesterInput = extractString(e)"
          />
        </view>
        <view class="input-row">
          <text class="input-label">周次</text>
          <t-input
            :value="weekInput"
            placeholder="如 1"
            type="number"
            @change="(e: any) => weekInput = extractString(e)"
          />
        </view>
        <t-button theme="primary" size="small" block @click="handleQuery">
          查询
        </t-button>
      </view>

      <!-- 周次快速选择 -->
      <view v-if="showWeekPicker" class="week-picker">
        <view
          v-for="w in 20"
          :key="w"
          :class="['week-item', { active: currentWeek === w }]"
          @tap="handleWeekChange(w)"
        >
          {{ w }}
        </view>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-wrap">
        <t-loading theme="circular" size="80rpx" />
        <text class="loading-text">正在获取课表...</text>
      </view>

      <!-- 错误状态 -->
      <view v-else-if="error" class="error-wrap">
        <t-icon name="close-circle" size="80rpx" color="#fa5151" />
        <text class="error-text">{{ error }}</text>
        <t-button theme="primary" size="small" @click="handleRefresh">重试</t-button>
      </view>

      <!-- 调试信息：返回 JSON -->
      <view v-else class="debug-section">
        <view class="debug-header">
          <text class="debug-title">返回数据（{{ courses.length }} 门课）</text>
          <text class="debug-hint">课表网格开发中，先验证数据</text>
        </view>

        <!-- 课程列表概览 -->
        <view v-if="courses.length > 0" class="course-cards">
          <view
            v-for="(course, idx) in courses"
            :key="idx"
            class="course-card"
            :style="{ backgroundColor: getCourseColor(course.courseName).bg }"
          >
            <text class="card-name" :style="{ color: getCourseColor(course.courseName).text }">
              {{ course.courseName }}
            </text>
            <text class="card-detail">{{ course.teacher }} | {{ course.location }}</text>
            <text class="card-detail">
              周{{ ['一','二','三','四','五','六','日'][course.col] || '?' }}
              第{{ course.row + 1 }}行 | {{ course.courseTime }}
            </text>
            <text class="card-detail">周次: {{ course.courseWeeks }}</text>
          </view>
        </view>
        <view v-else class="empty-hint">
          <text>暂无课程数据</text>
        </view>

        <!-- 原始 JSON（可折叠） -->
        <view class="json-section">
          <view class="json-toggle" @tap="showRawJson = !showRawJson">
            <text>{{ showRawJson ? '收起' : '展开' }} 原始 JSON</text>
            <t-icon :name="showRawJson ? 'chevron-up' : 'chevron-down'" size="28rpx" />
          </view>
          <view v-if="showRawJson" class="json-content">
            <text class="json-text" user-select>{{ rawJson || '无数据' }}</text>
          </view>
        </view>
      </view>

      <!-- ====== 课表网格骨架（注释掉，等数据验证后启用） ====== -->
      <!--
      <view class="schedule-grid">
        <view class="grid-header">
          <view class="corner-cell"></view>
          <view v-for="day in weekDays" :key="day.value"
            :class="['day-cell', { today: isToday(day.value) }]">
            <text class="day-name">{{ day.label }}</text>
            <text class="day-date">{{ day.date }}</text>
          </view>
        </view>
        <view class="grid-body">
          <view v-for="slot in timeSlots" :key="slot.row" class="time-row">
            <view class="time-cell">
              <text class="time-index">{{ slot.label }}</text>
              <text class="time-range">{{ slot.time }}</text>
            </view>
            <view v-for="day in 7" :key="day" class="course-cell">
            </view>
          </view>
        </view>
      </view>
      -->
    </view>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSchedule } from '@/hooks/useSchedule'
import { extractString } from '@/utils/tdesign'

const { ensure } = useAuthGuard()
const {
    courses, currentWeek, currentSemester, loading, error,
    rawJson, weekDays, timeSlots,
    fetchSchedule, getCourseColor, isToday,
} = useSchedule()

// ==================== 本地状态 ====================

const showSemesterInput = ref(false)
const showWeekPicker = ref(false)
const showRawJson = ref(false)
const semesterInput = ref('')
const weekInput = ref('')

// ==================== 方法 ====================

async function handleRefresh() {
    await fetchSchedule()
}

async function handleQuery() {
    const week = weekInput.value || undefined
    const semester = semesterInput.value || undefined
    if (week) currentWeek.value = parseInt(week) || 1
    if (semester) currentSemester.value = semester
    showSemesterInput.value = false
    await fetchSchedule(week, semester)
}

async function handleWeekChange(week: number) {
    currentWeek.value = week
    showWeekPicker.value = false
    await fetchSchedule(String(week), currentSemester.value || undefined)
}

// ==================== 生命周期 ====================

onShow(async () => {
    const result = await ensure({ requireSchoolLogin: true })
    if (result.success && result.logined) {
        // 首次加载：不传参数，使用后端默认
        if (courses.value.length === 0) {
            await fetchSchedule()
        }
    }
})
</script>

<style lang="scss" scoped>
.schedule-page {
    min-height: 100vh;
    background: #f5f5f5;
}

// 控制栏
.control-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 24rpx;
    background: #fff;
    gap: 16rpx;
}

.semester-selector,
.week-selector {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 12rpx 20rpx;
    background: #e3f2fd;
    border-radius: 24rpx;
    font-size: 26rpx;
    color: #1565c0;
}

.refresh-btn {
    padding: 12rpx;
    color: #666;

    .spinning {
        animation: spin 1s linear infinite;
    }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

// 输入面板
.input-panel {
    padding: 20rpx 24rpx;
    background: #fff;
    border-top: 1rpx solid #eee;
}

.input-row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 16rpx;
}

.input-label {
    font-size: 26rpx;
    color: #666;
    width: 80rpx;
    flex-shrink: 0;
}

// 周次选择器
.week-picker {
    display: flex;
    flex-wrap: wrap;
    padding: 16rpx 24rpx;
    background: #fff;
    border-top: 1rpx solid #eee;
    gap: 12rpx;
}

.week-item {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 26rpx;
    color: #333;
    background: #f5f5f5;

    &.active {
        background: #1565c0;
        color: #fff;
    }
}

// 加载/错误
.loading-wrap,
.error-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 100rpx 0;
    gap: 20rpx;
}

.loading-text,
.error-text {
    font-size: 26rpx;
    color: #999;
}

// 调试区域
.debug-section {
    padding: 20rpx 24rpx;
}

.debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;
}

.debug-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
}

.debug-hint {
    font-size: 22rpx;
    color: #999;
}

// 课程卡片
.course-cards {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    margin-bottom: 24rpx;
}

.course-card {
    padding: 20rpx 24rpx;
    border-radius: 12rpx;
}

.card-name {
    font-size: 28rpx;
    font-weight: 600;
    margin-bottom: 8rpx;
    display: block;
}

.card-detail {
    font-size: 24rpx;
    color: #666;
    display: block;
    margin-top: 4rpx;
}

.empty-hint {
    text-align: center;
    padding: 60rpx;
    font-size: 28rpx;
    color: #999;
}

// JSON 展示
.json-section {
    background: #fff;
    border-radius: 12rpx;
    overflow: hidden;
}

.json-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 24rpx;
    font-size: 26rpx;
    color: #666;
}

.json-content {
    padding: 0 24rpx 24rpx;
    max-height: 600rpx;
    overflow-y: auto;
}

.json-text {
    font-size: 22rpx;
    color: #333;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.6;
}
</style>
