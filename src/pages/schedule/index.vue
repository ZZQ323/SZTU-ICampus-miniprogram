<script setup lang="ts">
/**
 * 课表页面
 * 
 * 文件：src/pages/schedule/index.vue
 */

import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/hooks/useAuth'
import { useSchedule } from '@/hooks/useSchedule'
import { WEEKDAY_NAMES } from '@/api/types/schedule'
import { getTodayIndex } from '@/utils/date'

// Hooks
const { authState, ensureAuth, isLoggedIn } = useAuth()
const {
  courses, loading, error, currentWeek, weekDays, sections,
  fetchCourses, changeWeek, getCourse, showCourseDetail
} = useSchedule()

// 今天是周几 (用于高亮)
const todayIndex = ref(getTodayIndex())

// 页面显示时检查认证
onShow(async () => {
  const result = await ensureAuth()
  if (result.state === 'logged-in') {
    fetchCourses()
  }
})

// 下拉刷新
async function onRefresh() {
  if (!isLoggedIn.value) return
  await fetchCourses()
  uni.stopPullDownRefresh()
}

// 暴露给页面配置
defineExpose({ onPullDownRefresh: onRefresh })
</script>

<template>
  <view class="schedule-page">
    <!-- 加载中 -->
    <view v-if="authState === 'checking'" class="state-container">
      <t-loading theme="circular" size="40px" />
      <text class="state-text">检查登录状态...</text>
    </view>

    <!-- 需要登录 -->
    <view v-else-if="authState === 'need-login'" class="state-container">
      <t-icon name="lock-on" size="64px" color="#999" />
      <text class="state-text">请先登录查看课表</text>
      <t-button size="small" @click="ensureAuth()">去登录</t-button>
    </view>

    <!-- 已登录，显示课表 -->
    <template v-else-if="isLoggedIn">
      <!-- 周次选择器 -->
      <view class="week-selector">
        <t-button size="small" variant="text" @click="changeWeek(-1)">
          <t-icon name="chevron-left" />
        </t-button>
        <text class="week-text">第 {{ currentWeek }} 周</text>
        <t-button size="small" variant="text" @click="changeWeek(1)">
          <t-icon name="chevron-right" />
        </t-button>
      </view>

      <!-- 表头 -->
      <view class="grid-header">
        <view class="time-col"></view>
        <view v-for="(name, i) in WEEKDAY_NAMES" :key="i" class="day-col" :class="{ 'is-today': i === todayIndex }">
          <text class="day-name">{{ name }}</text>
          <text class="day-date">{{ weekDays[i]?.slice(5) }}</text>
        </view>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-body">
        <t-loading theme="circular" />
      </view>

      <!-- 错误状态 -->
      <view v-else-if="error" class="error-body">
        <text>{{ error }}</text>
        <t-button size="small" @click="fetchCourses()">重试</t-button>
      </view>

      <!-- 课表网格 -->
      <scroll-view v-else scroll-y class="grid-body">
        <view v-for="row in sections" :key="row" class="grid-row">
          <view class="time-col">{{ row + 1 }}</view>
          <view v-for="col in 7" :key="col" class="day-col" :class="{ 'is-today': col - 1 === todayIndex }">
            <view v-if="getCourse(col - 1, row)" class="course-cell"
              @click="showCourseDetail(getCourse(col - 1, row)!)">
              <text class="course-name">{{ getCourse(col - 1, row)?.courseName }}</text>
              <text class="course-loc">{{ getCourse(col - 1, row)?.location }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </template>

    <!-- 错误状态 -->
    <view v-else class="state-container">
      <t-icon name="error-circle" size="64px" color="#ff4d4f" />
      <text class="state-text">加载失败</text>
      <t-button size="small" @click="ensureAuth()">重试</t-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.schedule-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

.state-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
}

.state-text {
  color: #999;
  font-size: 28rpx;
}

.week-selector {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx 32rpx;
  border-bottom: 1rpx solid #eee;
  gap: 32rpx;
}

.week-text {
  font-size: 32rpx;
  font-weight: 500;
  min-width: 160rpx;
  text-align: center;
}

.grid-header,
.grid-row {
  display: flex;
}

.grid-header {
  border-bottom: 1rpx solid #eee;
  padding: 16rpx 0;
  background: #fafafa;
}

.time-col {
  width: 60rpx;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  flex-shrink: 0;
  line-height: 80rpx;
}

.day-col {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  min-height: 80rpx;
  position: relative;
  border-left: 1rpx solid #f0f0f0;

  &.is-today {
    background: rgba(25, 118, 210, 0.05);

    .day-name {
      color: #1976d2;
    }
  }
}

.day-name {
  display: block;
  font-weight: 500;
}

.day-date {
  display: block;
  color: #999;
  font-size: 20rpx;
}

.grid-body {
  flex: 1;
  overflow-y: auto;
}

.loading-body,
.error-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
}

.grid-row {
  border-bottom: 1rpx solid #f5f5f5;
}

.course-cell {
  margin: 4rpx;
  padding: 8rpx;
  background: #e3f2fd;
  border-radius: 8rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 60rpx;
}

.course-name {
  font-size: 20rpx;
  font-weight: 500;
  color: #1976d2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-loc {
  font-size: 18rpx;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>