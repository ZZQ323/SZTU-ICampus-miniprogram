<script setup lang="ts">
/**
 * 错误页面
 * 
 * 文件：src/pages/common/error/index.vue
 * 
 * 功能：
 * - 显示错误信息
 * - 提供重试按钮
 * - 提供返回首页按钮
 */

import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

// ==================== 参数 ====================

const errorMessage = ref('连接失败')
const retryable = ref(true)
const redirectTo = ref('/pages/home/home')
const redirectType = ref<'switchTab' | 'navigateTo' | 'reLaunch'>('switchTab')

onLoad((options) => {
    if (options?.message) {
        errorMessage.value = decodeURIComponent(options.message)
    }
    if (options?.retryable !== undefined) {
        retryable.value = options.retryable === 'true'
    }
    if (options?.redirect) {
        redirectTo.value = decodeURIComponent(options.redirect)
    }
    if (options?.type) {
        redirectType.value = options.type as any
    }
})

// ==================== 状态 ====================

const retrying = ref(false)
const retryCount = ref(0)
const maxRetry = 3

// ==================== 方法 ====================

function handleRetry() {
    if (retryCount.value >= maxRetry) {
        uni.showToast({
            title: '重试次数过多，请稍后再试',
            icon: 'none',
        })
        return
    }

    retryCount.value++
    retrying.value = true

    // 跳转到 loading 页重新初始化
    uni.redirectTo({
        url: `/pages/common/loading/index?redirect=${encodeURIComponent(redirectTo.value)}&type=${redirectType.value}&firstLoad=true`
    })
}

function handleGoHome() {
    uni.switchTab({ url: '/pages/home/home' })
}

function handleGoBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
        uni.navigateBack()
    } else {
        handleGoHome()
    }
}
</script>

<template>
    <view class="error-page">
        <view class="content">
            <!-- 错误图标 -->
            <view class="icon-wrapper">
                <t-icon name="close-circle" size="120rpx" color="#ff4d4f" />
            </view>

            <!-- 错误标题 -->
            <text class="error-title">连接失败</text>

            <!-- 错误信息 -->
            <text class="error-message">{{ errorMessage }}</text>

            <!-- 可能原因 -->
            <view class="reason-box">
                <text class="reason-title">可能的原因：</text>
                <view class="reason-list">
                    <text class="reason-item">• 学校服务器繁忙</text>
                    <text class="reason-item">• 网络连接不稳定</text>
                    <text class="reason-item">• 首次加载需要较长时间</text>
                </view>
            </view>

            <!-- 操作按钮 -->
            <view class="action-area">
                <t-button v-if="retryable" theme="primary" size="large" block :loading="retrying" @click="handleRetry">
                    {{ retrying ? '正在重试...' : '重试' }}
                </t-button>

                <view v-if="retryable" class="retry-hint">
                    <text v-if="retryCount > 0">已重试 {{ retryCount }} 次，最多 {{ maxRetry }} 次</text>
                </view>

                <t-button theme="default" size="large" block class="btn-secondary" @click="handleGoHome">
                    返回首页
                </t-button>
            </view>
        </view>
    </view>
</template>

<style lang="scss" scoped>
.error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    padding: 48rpx;
}

.content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 600rpx;
    background: #fff;
    border-radius: 24rpx;
    padding: 64rpx 48rpx;
    box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.08);
}

.icon-wrapper {
    margin-bottom: 32rpx;
}

.error-title {
    font-size: 40rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 16rpx;
}

.error-message {
    font-size: 28rpx;
    color: #666;
    text-align: center;
    margin-bottom: 48rpx;
    line-height: 1.5;
}

.reason-box {
    width: 100%;
    padding: 24rpx 32rpx;
    background: #fafafa;
    border-radius: 12rpx;
    margin-bottom: 48rpx;
}

.reason-title {
    font-size: 26rpx;
    color: #666;
    margin-bottom: 16rpx;
    display: block;
}

.reason-list {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.reason-item {
    font-size: 24rpx;
    color: #999;
    line-height: 1.6;
}

.action-area {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 24rpx;
}

.btn-secondary {
    margin-top: 8rpx;
}

.retry-hint {
    text-align: center;
    font-size: 24rpx;
    color: #999;
    min-height: 32rpx;
}
</style>