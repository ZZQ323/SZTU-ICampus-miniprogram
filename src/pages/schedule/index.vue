<!--
  课表页面 - 重构版
  
  文件路径: src/pages/schedule/index.vue
-->
<template>
  <view class="schedule-page">
    <!-- 连接状态 -->
    <view class="status-bar" :class="status">
      <text v-if="status === 'connecting'">正在连接...</text>
      <text v-else-if="status === 'connected'">● 已连接</text>
      <text v-else-if="status === 'disconnected'">○ 已断开</text>
      <text v-else-if="status === 'error'">连接错误</text>
    </view>
    
    <!-- 标题 -->
    <view class="header">
      <text class="title">我的课表</text>
      <view class="week-selector">
        <text>第 {{ currentWeek }} 周</text>
      </view>
    </view>
    
    <!-- 课表网格 -->
    <view class="schedule-grid">
      <!-- 表头 -->
      <view class="grid-header">
        <view class="corner-cell" />
        <view 
          v-for="day in weekDays" 
          :key="day.value" 
          class="day-cell"
          :class="{ today: isToday(day.value) }"
        >
          <text class="day-name">{{ day.label }}</text>
          <text class="day-date">{{ day.date }}</text>
        </view>
      </view>
      
      <!-- 课表主体 -->
      <view class="grid-body">
        <view 
          v-for="slot in timeSlots" 
          :key="slot.row" 
          class="time-row"
        >
          <view class="time-cell">
            <text class="time-index">{{ slot.label }}</text>
            <text class="time-range">{{ slot.time }}</text>
          </view>
          
          <view 
            v-for="day in 7" 
            :key="day" 
            class="course-cell"
            @click="showCourseDetail(slot.row, day - 1)"
          >
            <template v-if="getCourse(slot.row, day - 1)">
              <view 
                class="course-card"
                :style="{ backgroundColor: getCourseColor(getCourse(slot.row, day - 1)) }"
              >
                <text class="course-name">{{ getCourse(slot.row, day - 1)?.courseName }}</text>
                <text class="course-location">{{ getCourse(slot.row, day - 1)?.location }}</text>
              </view>
            </template>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 加载遮罩 -->
    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner" />
      <text>加载中...</text>
    </view>
    
    <!-- 认证弹窗 -->
    <view v-if="showAuthDialog" class="auth-dialog" @click="closeAuthDialog">
      <view class="dialog-content" @click.stop>
        <text class="dialog-title">登录已过期</text>
        <text class="dialog-message">{{ authMessage }}</text>
        <button class="dialog-btn" @click="goToLogin">重新登录</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useSchedule } from '@/hooks/useSchedule'
import { useSSE } from '@/hooks/useSSE'

// ==================== Hooks ====================

const {
  courses,
  currentWeek,
  loading,
  weekDays,
  timeSlots,
  updateCourses,
  getCourse,
  getCourseColor,
  isToday,
  showCourseDetail
} = useSchedule()

const {
  status,
  showAuthDialog,
  authMessage,
  goToLogin,
  closeAuthDialog
} = useSSE('schedule', {
  onMessage: (data) => {
    console.log('收到课表数据:', data)
    
    // 处理刷新提示
    if (data?.action === 'REFRESH_HINT') {
      uni.showToast({ title: data.message || '有新的课表更新', icon: 'none' })
      return
    }
    
    // 更新课表
    updateCourses(data)
  }
})
</script>

<style lang="scss" scoped>
.schedule-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 20rpx;
}

.status-bar {
  padding: 8rpx 20rpx;
  text-align: center;
  font-size: 24rpx;
  
  &.connecting { background: #fff3cd; color: #856404; }
  &.connected { background: #d4edda; color: #155724; }
  &.disconnected { background: #e2e3e5; color: #6c757d; }
  &.error { background: #f8d7da; color: #721c24; }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 30rpx;
  background: #fff;
  
  .title { font-size: 36rpx; font-weight: bold; }
  .week-selector { font-size: 28rpx; color: #666; }
}

.schedule-grid {
  margin: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.grid-header {
  display: grid;
  grid-template-columns: 100rpx repeat(7, 1fr);
  background: #f8f9fa;
  border-bottom: 1rpx solid #e9ecef;
  
  .corner-cell { border-right: 1rpx solid #e9ecef; }
  
  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 0;
    border-right: 1rpx solid #e9ecef;
    
    &:last-child { border-right: none; }
    &.today { background: #e3f2fd; .day-name { color: #1976d2; font-weight: bold; } }
    
    .day-name { font-size: 26rpx; color: #333; }
    .day-date { font-size: 22rpx; color: #999; margin-top: 4rpx; }
  }
}

.grid-body {
  .time-row {
    display: grid;
    grid-template-columns: 100rpx repeat(7, 1fr);
    min-height: 160rpx;
    border-bottom: 1rpx solid #e9ecef;
    &:last-child { border-bottom: none; }
  }
  
  .time-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #f8f9fa;
    border-right: 1rpx solid #e9ecef;
    
    .time-index { font-size: 26rpx; font-weight: bold; color: #333; }
    .time-range { font-size: 18rpx; color: #999; margin-top: 4rpx; }
  }
  
  .course-cell {
    padding: 8rpx;
    border-right: 1rpx solid #e9ecef;
    &:last-child { border-right: none; }
  }
}

.course-card {
  height: 100%;
  border-radius: 8rpx;
  padding: 12rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  .course-name {
    font-size: 22rpx;
    font-weight: bold;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  
  .course-location {
    font-size: 18rpx;
    color: #666;
    margin-top: 4rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
  
  .loading-spinner {
    width: 60rpx;
    height: 60rpx;
    border: 4rpx solid #e9ecef;
    border-top-color: #1976d2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  text { margin-top: 20rpx; color: #666; }
}

@keyframes spin { to { transform: rotate(360deg); } }

.auth-dialog {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  
  .dialog-content {
    width: 80%;
    max-width: 600rpx;
    background: #fff;
    border-radius: 16rpx;
    padding: 40rpx;
    text-align: center;
    
    .dialog-title { font-size: 32rpx; font-weight: bold; color: #333; }
    .dialog-message { display: block; margin-top: 20rpx; font-size: 28rpx; color: #666; }
    .dialog-btn {
      margin-top: 40rpx;
      background: #1976d2;
      color: #fff;
      border: none;
      border-radius: 8rpx;
      padding: 20rpx 60rpx;
      font-size: 28rpx;
    }
  }
}
</style>
