<!--
  课表页面（改进版 - 等待认证完成后才显示内容）
  
  文件：src/pages/schedule/schedule.vue
  
  改动点：
  1. 使用 v-if="isReady" 控制内容显示
  2. 强制登录，认证失败跳转登录页
  3. 登录页会携带 loginTypes 参数
-->

<template>
  <PageLayout>
    课表
  </PageLayout>
</template>

<script setup lang="ts">
/**
 * 课表页面（改进版）
 * 
 * 使用 isReady 控制内容显示，强制登录
 */
// import { ref, computed } from 'vue'
// import { onShow, onHide } from '@dcloudio/uni-app'
// import PageLayout from '@/components/PageLayout.vue'
// import { useAuthGuard } from '@/hooks/composables/useAuthGuard'
// import { useSchedule } from '@/hooks/useSchedule'

// // ==================== Hooks ====================

// const { ensure, isReady } = useAuthGuard()

// const {
//   courses,
//   currentWeek,
//   loading,
//   weekDays,
//   timeSlots,
//   updateCourses,
//   getCourse,
//   getCourseColor,
//   isToday,
//   fetchSchedule
// } = useSchedule()


// // ==================== 状态 ====================

// const showWeekPicker = ref(false)
// const showCourseDetail = ref(false)
// const selectedCourse = ref<any>(null)

// // ==================== 计算属性 ====================

// const connectionStatus = computed(() => {
//   switch (sseStatus.value) {
//     case 'connected': return 'connected'
//     case 'connecting': return 'connecting'
//     case 'error': return 'error'
//     default: return 'disconnected'
//   }
// })

// const statusText = computed(() => {
//   switch (sseStatus.value) {
//     case 'connected': return '实时连接中'
//     case 'connecting': return '正在连接...'
//     case 'error': return '连接失败'
//     default: return '未连接'
//   }
// })

// // ==================== 生命周期 ====================

// onShow(async () => {
//   // ⭐ 改进：使用 ensure 进行认证检查
//   // requireSchoolLogin: true 表示必须登录
//   // redirectOnFail: true 表示登录失败时跳转登录页
//   const result = await ensure({
//     requireSchoolLogin: true,
//     redirectOnFail: true
//   })

//   // 只有认证成功才加载数据
//   if (result.success) {
//     await loadData()
//     connectSSE()
//   }
// })

// onHide(() => {
//   disconnectSSE()
// })

// // ==================== 方法 ====================

// async function loadData() {
//   try {
//     await fetchSchedule()
//   } catch (e) {
//     console.error('[Schedule] 加载课表失败', e)
//   }
// }

// function handleSSEMessage(data: any) {
//   console.log('[Schedule] 收到 SSE 消息', data)

//   if (data?.action === 'REFRESH_HINT') {
//     uni.showToast({
//       title: data.message || '课表有更新',
//       icon: 'none'
//     })
//     return
//   }

//   if (data?.courses) {
//     updateCourses(data)
//   }
// }

// function handleSSEError(error: any) {
//   console.warn('[Schedule] SSE 错误', error)
// }

// function handleCourseClick(row: number, day: number) {
//   const course = getCourse(row, day)
//   if (course) {
//     selectedCourse.value = course
//     showCourseDetail.value = true
//   }
// }

// async function handleRefresh() {
//   await loadData()
// }
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