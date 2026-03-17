<!--
  悬浮按钮组件（重构版）
  
  文件：src/components/common/FloatingNotification.vue
  
  功能：
  - 主按钮显示总未读数
  - 展开显示公告、日历入口（各自带未读数）
  - 集成新消息浮窗
-->
<template>
    <view class="fab-wrapper">
        <!-- 展开的菜单 -->
        <view v-if="isExpanded" class="fab-menu">
            <view v-for="item in menuItems" :key="item.id" class="fab-menu-item" @tap="handleMenuTap(item)">
                <view class="menu-icon-wrapper">
                    <t-icon :name="item.icon" size="40rpx" :color="item.color" />
                    <view v-if="item.unread > 0" class="menu-badge">
                        {{ item.unread > 99 ? '99+' : item.unread }}
                    </view>
                </view>
                <text class="menu-label">{{ item.label }}</text>
            </view>
        </view>

        <!-- 遮罩层 -->
        <view v-if="isExpanded" class="fab-overlay" @tap="isExpanded = false" />

        <!-- 主按钮 -->
        <view class="fab-main" :class="{ 'is-expanded': isExpanded }" @tap="toggleExpand">
            <t-icon :name="isExpanded ? 'close' : 'notification'" size="44rpx" color="#fff" />

            <!-- 总未读红点（折叠时显示） -->
            <view v-if="!isExpanded && totalUnread > 0" class="fab-badge">
                {{ totalUnread > 99 ? '99+' : totalUnread }}
            </view>
        </view>

        <!-- 新消息浮窗 -->
        <NewMessageToast :message="newMessage" @tap="handleToastTap" @close="handleToastClose" />
    </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useInfoStore } from '@/store/modules/info'
import NewMessageToast from './NewMessageToast.vue'

// ==================== Store ====================

const infoStore = useInfoStore()

// ==================== 状态 ====================

const isExpanded = ref(false)

// ==================== 计算属性 ====================

const totalUnread = computed(() => infoStore.totalUnread)
const newMessage = computed(() => infoStore.newMessage)

const menuItems = computed(() => [
    {
        id: 'announcement',
        label: '公告',
        icon: 'notification',
        color: '#0052d9',
        unread: infoStore.getUnreadCount('announcement'),
        path: '/pages/notice/notice'
    },
    {
        id: 'activity',
        label: '日历',
        icon: 'calendar',
        color: '#07c160',
        unread: infoStore.getUnreadCount('activity'),
        path: '/pages/calendar/calendar'
    }
])

// ==================== 方法 ====================

function toggleExpand() {
    isExpanded.value = !isExpanded.value
}

function handleMenuTap(item: typeof menuItems.value[0]) {
    isExpanded.value = false

    // TabBar 页面用 switchTab，其他用 navigateTo
    if (item.path === '/pages/notice/notice') {
        uni.switchTab({ url: item.path })
    } else {
        uni.navigateTo({ url: item.path })
    }
}

function handleToastTap(message: any) {
    infoStore.clearNewMessage()

    // 跳转到公告页
    if (message.channelId === 'announcement') {
        uni.switchTab({ url: '/pages/notice/notice' })
    } else {
        uni.navigateTo({ url: `/pages/calendar/calendar` })
    }
}

function handleToastClose() {
    infoStore.clearNewMessage()
}

// ==================== 暴露方法 ====================

/**
 * 显示新消息浮窗（供外部调用）
 */
function showNewMessage(message: any) {
    infoStore.newMessage = message
}

defineExpose({
    showNewMessage
})
</script>

<style lang="scss" scoped>
.fab-wrapper {
    position: fixed;
    right: 32rpx;
    bottom: 200rpx;
    z-index: 1000;
}

.fab-main {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #0052d9, #0066ff);
    box-shadow: 0 8rpx 24rpx rgba(0, 82, 217, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 0.2s ease;

    &:active {
        transform: scale(0.95);
    }

    &.is-expanded {
        background: #666;
        box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
        transform: rotate(90deg);
    }
}

.fab-badge {
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    min-width: 36rpx;
    height: 36rpx;
    padding: 0 10rpx;
    font-size: 22rpx;
    font-weight: 600;
    color: #fff;
    background-color: #f54a45;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2rpx 8rpx rgba(245, 74, 69, 0.4);
}

.fab-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: -1;
}

.fab-menu {
    position: absolute;
    bottom: 116rpx;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    animation: fadeInUp 0.2s ease-out;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20rpx);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.fab-menu-item {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 16rpx 24rpx 16rpx 16rpx;
    background: #fff;
    border-radius: 48rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);

    &:active {
        background: #f5f5f5;
    }
}

.menu-icon-wrapper {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.menu-badge {
    position: absolute;
    top: -6rpx;
    right: -6rpx;
    min-width: 28rpx;
    height: 28rpx;
    padding: 0 6rpx;
    font-size: 18rpx;
    font-weight: 600;
    color: #fff;
    background-color: #f54a45;
    border-radius: 14rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.menu-label {
    font-size: 28rpx;
    color: #333;
    white-space: nowrap;
}
</style>