<!--
  认证遮罩组件
  
  文件：src/components/AuthMask.vue
  
  功能：
  - 在认证检查过程中显示全屏遮罩
  - 防止用户看到可能过期的个人信息
  - 显示当前检查阶段和加载动画
  
  使用方式：
  在 App.vue 中全局挂载，无需在每个页面引入
-->

<template>
    <view v-if="authStore.showMask" class="auth-mask" @touchmove.stop.prevent>
        <view class="mask-backdrop" />
        <view class="mask-content">
            <!-- 加载动画 -->
            <view class="loading-wrapper">
                <t-loading theme="circular" size="80rpx" />
            </view>

            <!-- 状态文字 -->
            <text class="mask-message">{{ message }}</text>

            <!-- 阶段指示器 -->
            <view class="phase-indicator">
                <view v-for="(item, index) in phases" :key="item.key" class="phase-dot" :class="{
                    active: currentPhaseIndex >= index,
                    current: currentPhaseIndex === index
                }" />
            </view>

            <!-- 提示文字 -->
            <text class="mask-hint">请稍候...</text>
        </view>
    </view>
</template>

<script setup lang="ts">
/**
 * 认证遮罩组件
 */
import { computed } from 'vue'
import { useAuthStore } from '@/store/modules/auth'

const authStore = useAuthStore()

// 阶段配置
const phases = [
    { key: 'checking-token', label: '验证身份' },
    { key: 'refreshing-token', label: '刷新状态' },
    { key: 'checking-school', label: '检查服务' }
]

// 当前阶段索引
const currentPhaseIndex = computed(() => {
    const phase = authStore.phase
    const index = phases.findIndex(p => p.key === phase)
    return index >= 0 ? index : 0
})

// 显示的消息
const message = computed(() => {
    return authStore.checkingMessage || '正在处理...'
})
</script>

<style lang="scss" scoped>
.auth-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.mask-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
}

.mask-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60rpx 80rpx;
    background: #ffffff;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    min-width: 400rpx;
}

.loading-wrapper {
    margin-bottom: 32rpx;
}

.mask-message {
    font-size: 32rpx;
    color: #333333;
    font-weight: 500;
    text-align: center;
    margin-bottom: 24rpx;
}

.phase-indicator {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 24rpx;
}

.phase-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
    background: #e0e0e0;
    transition: all 0.3s ease;

    &.active {
        background: #1976d2;
    }

    &.current {
        width: 24rpx;
        height: 24rpx;
        animation: pulse 1s ease-in-out infinite;
    }
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.2);
        opacity: 0.8;
    }
}

.mask-hint {
    font-size: 24rpx;
    color: #999999;
}
</style>