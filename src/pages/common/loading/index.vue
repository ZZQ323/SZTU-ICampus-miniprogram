<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const message = ref('加载中...')
const redirectUrl = ref('')
const taskType = ref('')

// 页面参数：?redirect=/pages/home/index&task=checkLogin&message=正在检查登录状态
onLoad((options) => {
    redirectUrl.value = decodeURIComponent(options?.redirect || '/pages/home/index')
    taskType.value = options?.task || ''
    message.value = decodeURIComponent(options?.message || '加载中...')
})

onMounted(async () => {
    try {
        // 根据 task 类型执行不同的异步操作
        await executeTask(taskType.value)
        // 任务完成，跳转目标页面
        navigateToTarget()
    } catch (e) {
        // 出错跳转 error 页面
        const errorMsg = e instanceof Error ? e.message : '未知错误'
        uni.redirectTo({
            url: `/pages/common/error/index?message=${encodeURIComponent(errorMsg)}&redirect=${encodeURIComponent(redirectUrl.value)}`
        })
    }
})

async function executeTask(task: string) {
    switch (task) {
        case 'checkLogin':
            // 示例：检查登录状态
            await sleep(1000)
            break
        case 'initData':
            // 示例：初始化数据
            await sleep(800)
            break
        default:
            // 无特定任务，直接等待一小段时间
            await sleep(500)
    }
}

function navigateToTarget() {
    const url = redirectUrl.value
    // 判断是否是 tabBar 页面
    const tabBarPages = ['/pages/home/index', '/pages/schedule/index', '/pages/notice/index']
    if (tabBarPages.some(p => url.includes(p))) {
        uni.switchTab({ url })
    } else {
        uni.redirectTo({ url })
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
</script>

<template>
    <view class="loading-page">
        <t-loading theme="circular" size="80rpx" />
        <text class="message">{{ message }}</text>
    </view>
</template>

<style lang="scss" scoped>
.loading-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #fff;
}

.message {
    margin-top: 32rpx;
    font-size: 28rpx;
    color: #666;
}
</style>