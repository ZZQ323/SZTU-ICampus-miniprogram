<!--
  新消息浮窗组件
  
  文件：src/components/common/NewMessageToast.vue
  
  功能：
  - 顶部滑入动画
  - 3秒自动消失
  - 点击跳转
-->
<template>
    <view v-if="visible" class="toast-container" :class="{ 'is-hiding': isHiding }" @tap="handleTap">
        <view class="toast-icon">
            <t-icon name="notification" size="36rpx" color="#0052d9" />
        </view>

        <view class="toast-content">
            <text class="toast-title">{{ displayTitle }}</text>
            <text class="toast-desc">{{ displayDesc }}</text>
        </view>

        <view class="toast-close" @tap.stop="handleClose">
            <t-icon name="close" size="28rpx" color="#999" />
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

// ==================== Props ====================

interface ToastMessage {
    channelId?: string
    latestId?: string
    count?: number
    title?: string
    sourceName?: string
}

const props = defineProps<{
    message: ToastMessage | null
    /** 自动关闭时间（毫秒），0 表示不自动关闭 */
    duration?: number
}>()

const emit = defineEmits<{
    tap: [message: ToastMessage]
    close: []
}>()

// ==================== 状态 ====================

const visible = ref(false)
const isHiding = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
let animTimer: ReturnType<typeof setTimeout> | null = null

// ==================== 计算属性 ====================

const displayTitle = computed(() => {
    if (props.message?.title) {
        return props.message.title
    }
    const count = props.message?.count || 1
    return `${count} 条新消息`
})

const displayDesc = computed(() => {
    if (props.message?.sourceName) {
        return props.message.sourceName
    }

    const channelMap: Record<string, string> = {
        announcement: '公文通知',
        news: '新闻动态',
        activity: '活动日历',
        job: '招聘求职',
    }

    return channelMap[props.message?.channelId || 'announcement'] || '公文通知'
})

// ==================== 监听 ====================

watch(() => props.message, (newMsg) => {
    if (newMsg) {
        show()
    }
}, { immediate: true })

// ==================== 方法 ====================

function show() {
    // 清除之前的定时器
    clearTimers()

    // 显示
    isHiding.value = false
    visible.value = true

    // 设置自动隐藏
    const duration = props.duration ?? 3000
    if (duration > 0) {
        hideTimer = setTimeout(() => {
            hide()
        }, duration)
    }
}

function hide() {
    isHiding.value = true
    animTimer = setTimeout(() => {
        visible.value = false
        isHiding.value = false
        emit('close')
    }, 300)
}

function clearTimers() {
    if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
    }
    if (animTimer) {
        clearTimeout(animTimer)
        animTimer = null
    }
}

function handleTap() {
    if (props.message) {
        emit('tap', props.message)
    }
    hide()
}

function handleClose() {
    hide()
}

// ==================== 生命周期 ====================

onUnmounted(() => {
    clearTimers()
})

// ==================== 暴露方法 ====================

defineExpose({
    show,
    hide,
})
</script>

<style lang="scss" scoped>
.toast-container {
    position: fixed;
    top: calc(var(--status-bar-height, 44px) + 100rpx);
    left: 32rpx;
    right: 32rpx;
    padding: 24rpx;
    background: #fff;
    border-radius: 16rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
    display: flex;
    align-items: center;
    gap: 20rpx;
    z-index: 2000;
    animation: slideIn 0.3s ease-out;

    &.is-hiding {
        animation: slideOut 0.3s ease-in forwards;
    }
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-40rpx);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideOut {
    from {
        opacity: 1;
        transform: translateY(0);
    }

    to {
        opacity: 0;
        transform: translateY(-40rpx);
    }
}

.toast-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: rgba(0, 82, 217, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.toast-content {
    flex: 1;
    min-width: 0;
}

.toast-title {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
}

.toast-desc {
    font-size: 24rpx;
    color: #999;
    margin-top: 4rpx;
    display: block;
}

.toast-close {
    width: 48rpx;
    height: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin: -8rpx;
}
</style>