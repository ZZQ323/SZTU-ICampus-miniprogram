<!--
  悬浮通知组件
  
  文件：src/components/FloatingNotification.vue
  
  功能：
  - 右下角悬浮按钮，点击展开菜单
  - 显示公告和日历的未读数
  - 点击跳转到相应页面
  - 自动管理 SSE 连接
  
  使用方式：在每个需要显示的页面中引入
  <FloatingNotification />
-->

<template>
    <!-- 遮罩层（展开时显示） -->
    <view v-if="expanded" class="fab-overlay" @tap="expanded = false" />

    <!-- 悬浮按钮容器 -->
    <view class="fab-container" :style="containerStyle">
        <!-- 展开的菜单项 -->
        <view v-if="expanded" class="fab-menu">
            <!-- 公告按钮 -->
            <view class="fab-menu-item" @tap="goAnnouncement">
                <view class="fab-menu-icon announcement">
                    <t-icon name="notification" size="40rpx" />
                    <view v-if="sseStore.announcementUnread > 0" class="badge">
                        {{ sseStore.announcementUnread > 99 ? '99+' : sseStore.announcementUnread }}
                    </view>
                </view>
                <text class="fab-menu-label">公告</text>
            </view>

            <!-- 日历按钮 -->
            <view class="fab-menu-item" @tap="goCalendar">
                <view class="fab-menu-icon calendar">
                    <t-icon name="calendar" size="40rpx" />
                    <view v-if="sseStore.calendarUnread > 0" class="badge">
                        {{ sseStore.calendarUnread > 99 ? '99+' : sseStore.calendarUnread }}
                    </view>
                </view>
                <text class="fab-menu-label">日历</text>
            </view>
        </view>

        <!-- 主按钮 -->
        <view class="fab-main" :class="{ expanded: expanded, 'has-unread': sseStore.hasUnread }" @tap="toggleExpand">
            <t-icon :name="expanded ? 'close' : 'add'" size="48rpx" />
            <view v-if="!expanded && sseStore.hasUnread" class="fab-badge">
                {{ sseStore.totalUnread > 99 ? '99+' : sseStore.totalUnread }}
            </view>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useSseStore } from '@/store/modules/sse'
import { useUserStore } from '@/store/modules/user'

const sseStore = useSseStore()
const userStore = useUserStore()

// ==================== 状态 ====================

const expanded = ref(false)

// ==================== 计算属性 ====================

// 容器样式（避开 TabBar）
const containerStyle = computed(() => {
    // 获取页面信息判断是否是 TabBar 页面
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const isTabBarPage = isTabBar(currentPage?.route || '')

    return {
        bottom: isTabBarPage ? '180rpx' : '100rpx',
        right: '40rpx'
    }
})

// ==================== 方法 ====================

function toggleExpand() {
    expanded.value = !expanded.value
}

function goAnnouncement() {
    expanded.value = false
    sseStore.markAnnouncementRead()
    uni.switchTab({ url: '/pages/notice/notice' })
}

function goCalendar() {
    expanded.value = false
    sseStore.markCalendarRead()
    uni.navigateTo({ url: '/pages/calendar/calendar' })
}

/**
 * 判断是否是 TabBar 页面
 */
function isTabBar(route: string): boolean {
    const tabBarPages = [
        'pages/home/index',
        'pages/schedule/schedule',
        'pages/notice/notice',
        'pages/mine/mine'
    ]
    return tabBarPages.some(p => route.includes(p))
}

// ==================== 生命周期 ====================

onShow(() => {
    // 检查并恢复 SSE 连接
    if (userStore.isSchoolLoggedIn) {
        sseStore.checkAndReconnect()
    }
})

onMounted(() => {
    // 首次加载时连接 SSE
    if (userStore.isSchoolLoggedIn && !sseStore.isConnected) {
        sseStore.connect()
    }
})
</script>

<style lang="scss" scoped>
.fab-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 998;
}

.fab-container {
    position: fixed;
    z-index: 999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.fab-main {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #1976d2, #1565c0);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 8rpx 24rpx rgba(25, 118, 210, 0.4);
    transition: all 0.3s ease;
    position: relative;

    &.expanded {
        transform: rotate(45deg);
        background: #666;
    }

    &.has-unread {
        animation: pulse 2s infinite;
    }

    &:active {
        transform: scale(0.95);

        &.expanded {
            transform: rotate(45deg) scale(0.95);
        }
    }
}

.fab-badge {
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    min-width: 36rpx;
    height: 36rpx;
    padding: 0 8rpx;
    background: #fa5151;
    border-radius: 18rpx;
    font-size: 22rpx;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 4rpx solid #fff;
}

.fab-menu {
    display: flex;
    flex-direction: column;
    gap: 24rpx;
    margin-bottom: 24rpx;
    animation: slideUp 0.2s ease;
}

.fab-menu-item {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 16rpx 24rpx;
    background: #fff;
    border-radius: 48rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);

    &:active {
        background: #f5f5f5;
    }
}

.fab-menu-icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    position: relative;

    &.announcement {
        background: linear-gradient(135deg, #ff9800, #f57c00);
    }

    &.calendar {
        background: linear-gradient(135deg, #4caf50, #388e3c);
    }

    .badge {
        position: absolute;
        top: -6rpx;
        right: -6rpx;
        min-width: 32rpx;
        height: 32rpx;
        padding: 0 6rpx;
        background: #fa5151;
        border-radius: 16rpx;
        font-size: 20rpx;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3rpx solid #fff;
    }
}

.fab-menu-label {
    font-size: 28rpx;
    color: #333;
    white-space: nowrap;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20rpx);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {

    0%,
    100% {
        box-shadow: 0 8rpx 24rpx rgba(25, 118, 210, 0.4);
    }

    50% {
        box-shadow: 0 8rpx 32rpx rgba(25, 118, 210, 0.6), 0 0 0 8rpx rgba(25, 118, 210, 0.1);
    }
}
</style>