<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const errorMessage = ref('出错了')
const redirectUrl = ref('')

// 页面参数：?message=网络错误&redirect=/pages/home/index
onLoad((options) => {
    errorMessage.value = decodeURIComponent(options?.message || '出错了')
    redirectUrl.value = decodeURIComponent(options?.redirect || '')
})

const handleRetry = () => {
    if (redirectUrl.value) {
        // 重试：跳回 loading 页重新执行任务
        uni.redirectTo({
            url: `/pages/common/loading/index?redirect=${encodeURIComponent(redirectUrl.value)}`
        })
    } else {
        // 无重定向地址，返回上一页
        uni.navigateBack()
    }
}

const handleGoHome = () => {
    uni.switchTab({ url: '/pages/home/index' })
}
</script>

<template>
    <view class="error-page">
        <view class="icon-wrapper">
            <t-icon name="close-circle" size="120rpx" color="#f56c6c" />
        </view>
        <text class="title">加载失败</text>
        <text class="message">{{ errorMessage }}</text>
        <view class="actions">
            <t-button theme="primary" @click="handleRetry">重试</t-button>
            <t-button variant="outline" @click="handleGoHome">返回首页</t-button>
        </view>
    </view>
</template>

<style lang="scss" scoped>
.error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 0 48rpx;
    background: #fff;
}

.icon-wrapper {
    margin-bottom: 32rpx;
}

.title {
    font-size: 36rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 16rpx;
}

.message {
    font-size: 28rpx;
    color: #999;
    text-align: center;
    margin-bottom: 48rpx;
}

.actions {
    display: flex;
    gap: 24rpx;
    width: 100%;

    :deep(.t-button) {
        flex: 1;
    }
}
</style>