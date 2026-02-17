<template>
  <template>
    <view class="schedule-page">
      <!-- 周选择器 -->
      <view class="week-selector">
        <t-button size="small" variant="text" @click="changeWeek(-1)">上周</t-button>
        <text class="week-text">第 {{ currentWeek }} 周</text>
        <t-button size="small" variant="text" @click="changeWeek(1)">下周</t-button>
      </view>

      <!-- 表头 -->
      <view class="grid-header">
        <view class="time-col"></view>
        <view v-for="(name, i) in WEEKDAY_NAMES" :key="i" class="day-col">
          <text class="day-name">{{ name }}</text>
          <text class="day-date">{{ weekDays[i]?.slice(5) }}</text>
        </view>
      </view>

      <!-- 课表网格 -->
      <scroll-view scroll-y class="grid-body">
        <view v-for="section in sections" :key="section" class="grid-row">
          <view class="time-col">{{ section }}</view>
          <view v-for="day in 7" :key="day" class="day-col">
            <view v-if="isFirstSection(day, section)" class="course-cell"
              :style="{ height: `${(getCourse(day, section)!.endSection - getCourse(day, section)!.startSection + 1) * 80}rpx` }"
              @click="uni.showToast({ title: getCourse(day, section)!.name, icon: 'none' })">
              <text class="course-name">{{ getCourse(day, section)?.name }}</text>
              <text class="course-loc">{{ getCourse(day, section)?.location }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </template>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { checkTabAuth } from '@/utils/router'
import { ref, computed } from 'vue'
import { getWeekStart, getWeekDays, WEEKDAY_NAMES } from '@/utils/date'
import type { CourseItem } from '@/api/types/schedule'

// TabBar 页面的权限检查（switchTab 不能被拦截器捕获）
onShow(() => {
  checkTabAuth()
})

const currentWeek = ref(1)
const weekStart = ref(getWeekStart())
const weekDays = computed(() => getWeekDays(weekStart.value))

// Mock 数据
const courses = ref<CourseItem[]>([
  { id: '1', name: '数据结构', teacher: '张老师', location: 'A101', dayOfWeek: 1, startSection: 1, endSection: 2, weeks: '1-16' },
  { id: '2', name: '操作系统', teacher: '李老师', location: 'B203', dayOfWeek: 2, startSection: 3, endSection: 4, weeks: '1-16' },
  { id: '3', name: '计算机网络', teacher: '王老师', location: 'C305', dayOfWeek: 3, startSection: 5, endSection: 6, weeks: '1-16' },
  { id: '4', name: '人工智能', teacher: '刘老师', location: 'D102', dayOfWeek: 4, startSection: 1, endSection: 2, weeks: '1-16' },
  { id: '5', name: '软件工程', teacher: '陈老师', location: 'A201', dayOfWeek: 5, startSection: 3, endSection: 4, weeks: '1-16' },
])

const sections = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

const getCourse = (day: number, section: number) => {
  return courses.value.find(c =>
    c.dayOfWeek === day && section >= c.startSection && section <= c.endSection
  )
}

const isFirstSection = (day: number, section: number) => {
  const course = getCourse(day, section)
  return course?.startSection === section
}

const changeWeek = (delta: number) => {
  currentWeek.value += delta
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + delta * 7)
  weekStart.value = d
}
</script>

<style lang="scss" scoped>
.schedule-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

.week-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 32rpx;
  border-bottom: 1rpx solid #eee;
}

.week-text {
  font-size: 32rpx;
  font-weight: 500;
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
}

.day-col {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  min-height: 80rpx;
  position: relative;
  border-left: 1rpx solid #f0f0f0;
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

.grid-row {
  border-bottom: 1rpx solid #f5f5f5;
}

.course-cell {
  position: absolute;
  left: 4rpx;
  right: 4rpx;
  top: 4rpx;
  background: #e3f2fd;
  border-radius: 8rpx;
  padding: 8rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.course-name {
  font-size: 22rpx;
  font-weight: 500;
  color: #1976d2;
}

.course-loc {
  font-size: 20rpx;
  color: #666;
}
</style>
