<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { checkTabAuth } from '@/utils/router'
import { getWeekStart, getWeekDays } from '@/utils/date'
import { WEEKDAY_NAMES, type CourseInfo } from '@/api/types/schedule'

onShow(() => checkTabAuth())

const currentWeek = ref(1)
const weekStart = ref(getWeekStart())
const weekDays = computed(() => getWeekDays(weekStart.value))

// Mock 数据（后端 CourseTableVO.CourseInfo 格式，row/col 都是 0-based）
const courses = ref<CourseInfo[]>([
  { courseId: '1', courseName: '数据结构', teacher: '张老师', location: 'A101', col: 0, row: 0, courseWeeks: '1-16', courseTime: '08:30-10:10' },
  { courseId: '2', courseName: '操作系统', teacher: '李老师', location: 'B203', col: 1, row: 2, courseWeeks: '1-16', courseTime: '10:20-12:00' },
  { courseId: '3', courseName: '计算机网络', teacher: '王老师', location: 'C305', col: 2, row: 4, courseWeeks: '1-16', courseTime: '14:00-15:40' },
  { courseId: '4', courseName: '人工智能', teacher: '刘老师', location: 'D102', col: 3, row: 0, courseWeeks: '1-16', courseTime: '08:30-10:10' },
  { courseId: '5', courseName: '软件工程', teacher: '陈老师', location: 'A201', col: 4, row: 2, courseWeeks: '1-16', courseTime: '10:20-12:00' },
])

const sections = Array.from({ length: 11 }, (_, i) => i)

const getCourse = (col: number, row: number) => courses.value.find(c => c.col === col && c.row === row)

const changeWeek = (delta: number) => {
  currentWeek.value += delta
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + delta * 7)
  weekStart.value = d
}

const showCourseDetail = (course: CourseInfo) => {
  uni.showModal({
    title: course.courseName,
    content: `教师: ${course.teacher || '未知'}\n地点: ${course.location}\n时间: ${course.courseTime}\n周次: ${course.courseWeeks}`,
    showCancel: false
  })
}
</script>

<template>
  <view class="schedule-page">
    <view class="week-selector">
      <t-button size="small" variant="text" @click="changeWeek(-1)">上周</t-button>
      <text class="week-text">第 {{ currentWeek }} 周</text>
      <t-button size="small" variant="text" @click="changeWeek(1)">下周</t-button>
    </view>

    <view class="grid-header">
      <view class="time-col"></view>
      <view v-for="(name, i) in WEEKDAY_NAMES" :key="i" class="day-col">
        <text class="day-name">{{ name }}</text>
        <text class="day-date">{{ weekDays[i]?.slice(5) }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="grid-body">
      <view v-for="row in sections" :key="row" class="grid-row">
        <view class="time-col">{{ row + 1 }}</view>
        <view v-for="col in 7" :key="col" class="day-col">
          <view v-if="getCourse(col - 1, row)" class="course-cell" @click="showCourseDetail(getCourse(col - 1, row)!)">
            <text class="course-name">{{ getCourse(col - 1, row)?.courseName }}</text>
            <text class="course-loc">{{ getCourse(col - 1, row)?.location }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

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
  line-height: 80rpx;
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
  margin: 4rpx;
  padding: 8rpx;
  background: #e3f2fd;
  border-radius: 8rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.course-name {
  font-size: 20rpx;
  font-weight: 500;
  color: #1976d2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-loc {
  font-size: 18rpx;
  color: #666;
}
</style>