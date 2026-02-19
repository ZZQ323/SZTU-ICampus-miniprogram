<script setup lang="ts">
/**
 * 加载中转页（改造版）
 * 
 * 文件：src/pages/common/loading/index.vue
 * 
 * 功能：
 * - 显示加载进度和已等待时间
 * - 首次加载时显示提示信息
 * - 支持取消操作
 * - 超时或失败时跳转 Error 页面
 */

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

// ==================== 参数 ====================

/** 跳转目标 */
let redirectTo = '/pages/home/index'
/** 跳转类型 */
let redirectType: 'switchTab' | 'navigateTo' | 'reLaunch' = 'switchTab'
/** 是否首次加载（无 Cookie） */
let isFirstLoad = true

onLoad((options) => {
    if (options?.redirect) {
        redirectTo = decodeURIComponent(options.redirect)
    }
    if (options?.type) {
        redirectType = options.type as any
    }
    if (options?.firstLoad !== undefined) {
        isFirstLoad = options.firstLoad === 'true'
    }
})

// ==================== 状态 ====================

const loading = ref(true)
const elapsedSeconds = ref(0)
const statusText = ref('正在连接学校服务器...')
const cancelled = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

// 是否显示首次加载提示
const showFirstLoadTip = computed(() => isFirstLoad && elapsedSeconds.value > 3)

// ==================== 生命周期 ====================

onMounted(async () => {
    // 启动计时器
    timer = setInterval(() => {
        elapsedSeconds.value++
        updateStatusText()
    }, 1000)

    try {
        // 1. 确保有 token
        if (!userStore.hasToken) {
            statusText.value = '正在获取授权...'
            await userStore.initToken()
        }

        // 检查是否已取消
        if (cancelled.value) return

        // 2. 初始化会话
        statusText.value = '正在连接学校服务器...'
        const result = await userStore.initSession()

        // 检查是否已取消
        if (cancelled.value) return

        // 3. 根据状态跳转
        if (result.logined) {
            // 已登录，跳转目标页
            doRedirect(redirectTo, redirectType)
        } else {
            // 未登录，跳转登录页
            uni.navigateTo({
                url: `/pages/login/index?redirect=${encodeURIComponent(redirectTo)}`
            })
        }
    } catch (e: any) {
        console.error('初始化失败', e)

        // 检查是否已取消
        if (cancelled.value) return

        // 跳转错误页面
        const errorMsg = encodeURIComponent(e?.message || '连接失败')
        const retryable = e?.retryable ? 'true' : 'false'
        uni.redirectTo({
            url: `/pages/common/error/index?message=${errorMsg}&retryable=${retryable}&redirect=${encodeURIComponent(redirectTo)}&type=${redirectType}`
        })
    } finally {
        loading.value = false
        if (timer) {
            clearInterval(timer)
            timer = null
        }
    }
})

onUnmounted(() => {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
})

// ==================== 方法 ====================

function updateStatusText() {
    const s = elapsedSeconds.value
    if (s < 5) {
        statusText.value = '正在连接学校服务器...'
    } else if (s < 15) {
        statusText.value = '正在加载资源...'
    } else if (s < 30) {
        statusText.value = '仍在努力连接中...'
    } else if (s < 60) {
        statusText.value = '学校服务器响应较慢，请耐心等待...'
    } else {
        statusText.value = '连接时间较长，您可以选择取消并稍后重试'
    }
}

function handleCancel() {
    cancelled.value = true
    loading.value = false
    if (timer) {
        clearInterval(timer)
        timer = null
    }
    // 返回上一页或首页
    const pages = getCurrentPages()
    if (pages.length > 1) {
        uni.navigateBack()
    } else {
        uni.switchTab({ url: '/pages/home/index' })
    }
}

function doRedirect(url: string, type: string) {
    switch (type) {
        case 'switchTab':
            uni.switchTab({ url })
            break
        case 'navigateTo':
            uni.navigateTo({ url })
            break
        case 'reLaunch':
            uni.reLaunch({ url })
            break
        default:
            uni.switchTab({ url })
    }
}

function formatTime(seconds: number): string {
    if (seconds < 60) {
        return `${seconds} 秒`
    }
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} 分 ${secs} 秒`
}
</script>

<template>
    <view class="loading-page">
        <view class="content">
            <!-- 加载动画 -->
            <view class="spinner">
                <t-loading theme="circular" size="48px" />
            </view>

            <!-- 状态文本 -->
            <text class="status-text">{{ statusText }}</text>

            <!-- 已等待时间 -->
            <text class="elapsed-text">已等待 {{ formatTime(elapsedSeconds) }}</text>

            <!-- 首次加载提示 -->
            <view v-if="showFirstLoadTip" class="tip-box">
                <t-icon name="info-circle" size="32rpx" color="#1976d2" />
                <text class="tip-text">
                    首次连接学校服务器可能需要 1-2 分钟，请耐心等待
                </text>
            </view>

            <!-- 取消按钮 -->
            <view class="action-area">
                <t-button v-if="elapsedSeconds > 10" theme="default" size="small" @click="handleCancel">
                    取消
                </t-button>
            </view>
        </view>
    </view>
</template>

<style lang="scss" scoped>
.loading-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    padding: 48rpx;
}

.content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 600rpx;
}

.spinner {
    margin-bottom: 48rpx;
}

.status-text {
    font-size: 32rpx;
    color: #333;
    margin-bottom: 16rpx;
    text-align: center;
}

.elapsed-text {
    font-size: 28rpx;
    color: #999;
    margin-bottom: 48rpx;
}

.tip-box {
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
    padding: 24rpx 32rpx;
    background: #e3f2fd;
    border-radius: 12rpx;
    margin-bottom: 48rpx;
    width: 100%;
}

.tip-text {
    flex: 1;
    font-size: 26rpx;
    color: #1976d2;
    line-height: 1.5;
}

.action-area {
    min-height: 80rpx;
}
</style>