<!--
  课表页面（重构版）
  
  文件：src/pages/schedule/index.vue
  
  改进点：
  1. 使用 useAuthGuard 进行认证检查
  2. 认证遮罩由全局组件处理
  3. 简化 SSE 连接逻辑
-->

<template>
  <view class="schedule-page">
    <!-- 连接状态栏 -->
    <view class="status-bar" :class="connectionStatus">
      <view class="status-dot" />
      <text>{{ statusText }}</text>
    </view>

    <!-- 头部 -->
    <view class="header">
      <text class="title">我的课表</text>
      <view class="week-selector" @click="showWeekPicker = true">
        <text>第 {{ currentWeek }} 周</text>
        <t-icon name="chevron-down" size="32rpx" />
      </view>
    </view>

    <!-- 课表网格 -->
    <view class="schedule-grid">
      <!-- 表头 -->
      <view class="grid-header">
        <view class="corner-cell" />
        <view v-for="day in weekDays" :key="day.value" class="day-cell" :class="{ today: isToday(day.value) }">
          <text class="day-name">{{ day.label }}</text>
          <text class="day-date">{{ day.date }}</text>
        </view>
      </view>

      <!-- 课表主体 -->
      <view class="grid-body">
        <view v-for="slot in timeSlots" :key="slot.row" class="time-row">
          <!-- 时间列 -->
          <view class="time-cell">
            <text class="time-index">{{ slot.label }}</text>
            <text class="time-range">{{ slot.time }}</text>
          </view>

          <!-- 课程单元格 -->
          <view v-for="day in 7" :key="day" class="course-cell" @click="handleCourseClick(slot.row, day - 1)">
            <template v-if="getCourse(slot.row, day - 1)">
              <view class="course-card" :style="{ backgroundColor: getCourseColor(getCourse(slot.row, day - 1)) }">
                <text class="course-name">{{ getCourse(slot.row, day - 1)?.courseName }}</text>
                <text class="course-location">{{ getCourse(slot.row, day - 1)?.location }}</text>
              </view>
            </template>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!loading && courses.length === 0" class="empty-state">
      <t-icon name="calendar" size="120rpx" color="#ddd" />
      <text class="empty-text">暂无课程数据</text>
      <t-button theme="light" size="small" @click="handleRefresh">
        刷新
      </t-button>
    </view>

    <!-- 课程详情弹窗 -->
    <t-popup v-model="showCourseDetail" placement="bottom">
      <view class="course-detail">
        <view class="detail-header">
          <text class="detail-title">{{ selectedCourse?.courseName }}</text>
          <t-icon name="close" size="40rpx" @click="showCourseDetail = false" />
        </view>
        <view class="detail-item">
          <t-icon name="location" size="36rpx" color="#999" />
          <text>{{ selectedCourse?.location || '未知地点' }}</text>
        </view>
        <view class="detail-item">
          <t-icon name="user" size="36rpx" color="#999" />
          <text>{{ selectedCourse?.teacher || '未知教师' }}</text>
        </view>
        <view class="detail-item">
          <t-icon name="time" size="36rpx" color="#999" />
          <text>第 {{ selectedCourse?.startWeek }}-{{ selectedCourse?.endWeek }} 周</text>
        </view>
      </view>
    </t-popup>
  </view>
</template>

<script setup lang="ts">
/**
 * 课表页面
 */
import { ref, computed, onMounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useSchedule } from '@/hooks/useSchedule'
import { useSSE } from '@/hooks/useSSE'

// ==================== Hooks ====================

const { ensure, isReady } = useAuthGuard()

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
  fetchSchedule
} = useSchedule()

const {
  status: sseStatus,
  connect: connectSSE,
  disconnect: disconnectSSE
} = useSSE('schedule', {
  onMessage: handleSSEMessage,
  onError: handleSSEError
})

// ==================== 状态 ====================

const showWeekPicker = ref(false)
const showCourseDetail = ref(false)
const selectedCourse = ref<any>(null)

// ==================== 计算属性 ====================

const connectionStatus = computed(() => {
  switch (sseStatus.value) {
    case 'connected': return 'connected'
    case 'connecting': return 'connecting'
    case 'error': return 'error'
    default: return 'disconnected'
  }
})

const statusText = computed(() => {
  switch (sseStatus.value) {
    case 'connected': return '实时连接中'
    case 'connecting': return '正在连接...'
    case 'error': return '连接失败'
    default: return '未连接'
  }
})

// ==================== 生命周期 ====================

onShow(async () => {
  // 使用 useAuthGuard 进行认证检查
  const result = await ensure({
    requireSchoolLogin: true,
    redirectOnFail: true
  })

  if (result.success) {
    // 认证成功，加载数据
    await loadData()
    // 连接 SSE
    connectSSE()
  }
})

onHide(() => {
  // 页面隐藏时断开 SSE
  disconnectSSE()
})

// ==================== 方法 ====================

/**
 * 加载课表数据
 */
async function loadData() {
  try {
    await fetchSchedule()
  } catch (e) {
    console.error('[Schedule] 加载课表失败', e)
  }
}

/**
 * 处理 SSE 消息
 */
function handleSSEMessage(data: any) {
  console.log('[Schedule] 收到 SSE 消息', data)

  // 处理刷新提示
  if (data?.action === 'REFRESH_HINT') {
    uni.showToast({
      title: data.message || '课表有更新',
      icon: 'none'
    })
    return
  }

  // 更新课表数据
  if (data?.courses) {
    updateCourses(data)
  }
}

/**
 * 处理 SSE 错误
 */
function handleSSEError(error: any) {
  console.warn('[Schedule] SSE 错误', error)
}

/**
 * 点击课程
 */
function handleCourseClick(row: number, day: number) {
  const course = getCourse(row, day)
  if (course) {
    selectedCourse.value = course
    showCourseDetail.value = true
  }
}

/**
 * 刷新数据
 */
async function handleRefresh() {
  await loadData()
}
</script>

<style lang="scss" scoped>
.schedule-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom);
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 12rpx 20rpx;
  font-size: 24rpx;

  .status-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
  }

  &.connected {
    background: #d4edda;
    color: #155724;

    .status-dot {
      background: #28a745;
    }
  }

  &.connecting {
    background: #fff3cd;
    color: #856404;

    .status-dot {
      background: #ffc107;
      animation: blink 1s infinite;
    }
  }

  &.disconnected {
    background: #e2e3e5;
    color: #6c757d;

    .status-dot {
      background: #6c757d;
    }
  }

  &.error {
    background: #f8d7da;
    color: #721c24;

    .status-dot {
      background: #dc3545;
    }
  }
}

@keyframes blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 30rpx;
  background: #fff;

  .title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }

  .week-selector {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 28rpx;
    color: #1976d2;
    padding: 12rpx 20rpx;
    background: #e3f2fd;
    border-radius: 24rpx;
  }
}

.schedule-grid {
  margin: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.grid-header {
  display: grid;
  grid-template-columns: 100rpx repeat(7, 1fr);
  background: #f8f9fa;
  border-bottom: 2rpx solid #e9ecef;

  .corner-cell {
    border-right: 2rpx solid #e9ecef;
  }

  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20rpx 0;
    border-right: 2rpx solid #e9ecef;

    &:last-child {
      border-right: none;
    }

    &.today {
      background: #e3f2fd;

      .day-name {
        color: #1976d2;
        font-weight: bold;
      }
    }

    .day-name {
      font-size: 26rpx;
      color: #333;
    }

    .day-date {
      font-size: 22rpx;
      color: #999;
      margin-top: 4rpx;
    }
  }
}

.grid-body {
  .time-row {
    display: grid;
    grid-template-columns: 100rpx repeat(7, 1fr);
    min-height: 160rpx;
    border-bottom: 2rpx solid #e9ecef;

    &:last-child {
      border-bottom: none;
    }
  }

  .time-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #f8f9fa;
    border-right: 2rpx solid #e9ecef;

    .time-index {
      font-size: 26rpx;
      font-weight: bold;
      color: #333;
    }

    .time-range {
      font-size: 18rpx;
      color: #999;
      margin-top: 4rpx;
    }
  }

  .course-cell {
    padding: 8rpx;
    border-right: 2rpx solid #e9ecef;

    &:last-child {
      border-right: none;
    }
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;

  .empty-text {
    margin: 24rpx 0;
    font-size: 28rpx;
    color: #999;
  }
}

.course-detail {
  padding: 40rpx;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32rpx;

    .detail-title {
      font-size: 36rpx;
      font-weight: bold;
      color: #333;
    }
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 20rpx 0;
    font-size: 28rpx;
    color: #666;
    border-bottom: 2rpx solid #f5f5f5;

    &:last-child {
      border-bottom: none;
    }
  }
}
</style>