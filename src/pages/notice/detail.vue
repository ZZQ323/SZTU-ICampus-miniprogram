<script setup lang="ts">
/**
 * 公告详情页
 * 
 * 文件：src/pages/notice/detail.vue
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import { useUserStore } from '@/store/modules/user'
import { infoApi } from '@/api/info-api'
import type { InfoContent } from '@/types/info'

// ==================== Store ====================

const userStore = useUserStore()

// ==================== 路由参数 ====================

const id = ref('')
const category = ref('')

// ==================== 状态 ====================

const loading = ref(true)
const content = ref<InfoContent | null>(null)
const error = ref('')

// ==================== 计算属性 ====================

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)

// ==================== Mock 数据 ====================

const mockContent: InfoContent = {
    id: '50731',
    title: '关于2025年春季学期教学安排的通知',
    author: '教务处',
    publishTime: '2025年01月15日 10:30',
    content: `
    <p>各学院、各部门：</p>
    <p>根据学校工作安排，现将2025年春季学期教学工作有关事项通知如下：</p>
    <p><strong>一、开学时间</strong></p>
    <p>2025年春季学期定于2月17日（农历正月十九，星期一）正式上课。</p>
    <p><strong>二、学生返校</strong></p>
    <p>学生于2月15日-16日返校报到注册。</p>
    <p><strong>三、教学准备</strong></p>
    <p>请各学院做好开学前的教学准备工作，确保教学工作顺利进行。</p>
    <p>特此通知。</p>
    <p style="text-align: right;">教务处</p>
    <p style="text-align: right;">2025年1月15日</p>
  `,
    attachments: [
        { name: '2025年春季学期校历.pdf', url: '#' },
        { name: '教学工作安排表.xlsx', url: '#' }
    ],
    prevId: '50730',
    prevTitle: '关于春节假期值班安排的通知',
    nextId: '50732',
    nextTitle: '关于举办学术讲座的通知'
}

// ==================== 方法 ====================

async function fetchDetail() {
    if (!id.value) {
        error.value = '参数错误'
        loading.value = false
        return
    }

    // 未登录显示 mock 数据
    if (!isLoggedIn.value) {
        content.value = { ...mockContent, id: id.value }
        loading.value = false
        return
    }

    loading.value = true
    error.value = ''
    
    try {
        const result = await infoApi.getDetail(id.value)
        content.value = result
    } catch (e: any) {
        console.error('[Detail] 获取详情失败', e)
        error.value = e.message || '加载失败'
    } finally {
        loading.value = false
    }
}

/** 跳转上一篇/下一篇 */
function navigateTo(targetId: string | undefined, targetCategory?: string) {
    if (!targetId) return
    uni.redirectTo({
        url: `/pages/notice/detail?id=${targetId}&category=${targetCategory || category.value}`
    })
}

/** 下载附件 */
function downloadAttachment(url: string, name: string) {
    if (!isLoggedIn.value) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
    }

    uni.showLoading({ title: '下载中...' })

    uni.downloadFile({
        url,
        success: (res) => {
            if (res.statusCode === 200) {
                uni.openDocument({
                    filePath: res.tempFilePath,
                    showMenu: true,
                    success: () => {
                        uni.hideLoading()
                    },
                    fail: () => {
                        uni.hideLoading()
                        uni.showToast({ title: '打开失败', icon: 'error' })
                    }
                })
            } else {
                uni.hideLoading()
                uni.showToast({ title: '下载失败', icon: 'error' })
            }
        },
        fail: () => {
            uni.hideLoading()
            uni.showToast({ title: '下载失败', icon: 'error' })
        }
    })
}

/** 分享 */
function handleShare() {
    // 小程序可以使用 onShareAppMessage
    uni.showToast({ title: '请点击右上角分享', icon: 'none' })
}

// ==================== 生命周期 ====================

onLoad((options) => {
    id.value = options?.id || ''
    category.value = options?.category || '1018'
    fetchDetail()
})
</script>

<template>
    <PageLayout>
        <view class="detail-page">
            <!-- 加载状态 -->
            <view v-if="loading" class="loading-wrap">
                <t-loading theme="circular" size="80rpx" />
                <text class="loading-text">加载中...</text>
            </view>

            <!-- 错误状态 -->
            <view v-else-if="error" class="error-wrap">
                <t-icon name="close-circle" size="120rpx" color="#fa5151" />
                <text class="error-text">{{ error }}</text>
                <t-button theme="primary" size="small" @click="fetchDetail">重试</t-button>
            </view>

            <!-- 内容 -->
            <view v-else-if="content" class="content-wrap">
                <!-- 未登录提示 -->
                <view v-if="!isLoggedIn" class="login-tip">
                    <t-icon name="info-circle" size="32rpx" />
                    <text>登录后可查看完整内容和下载附件</text>
                </view>

                <!-- 标题区域 -->
                <view class="header">
                    <view class="title">{{ content.title }}</view>
                    <view class="meta">
                        <text class="author">{{ content.author }}</text>
                        <text class="time">{{ content.publishTime }}</text>
                    </view>
                </view>

                <!-- 正文内容 -->
                <view class="article">
                    <rich-text :nodes="content.content" />
                </view>

                <!-- 附件 -->
                <view v-if="content.attachments && content.attachments.length > 0" class="attachments">
                    <view class="section-title">
                        <t-icon name="attach" size="32rpx" />
                        <text>附件 ({{ content.attachments.length }})</text>
                    </view>
                    <view v-for="(att, index) in content.attachments" :key="index" class="attachment-item"
                        @click="downloadAttachment(att.url, att.name)">
                        <t-icon name="file" size="36rpx" />
                        <text class="att-name">{{ att.name }}</text>
                        <t-icon name="download" size="36rpx" class="download-icon" />
                    </view>
                </view>

                <!-- 上一篇/下一篇 -->
                <view class="navigation">
                    <view :class="['nav-item', { disabled: !content.prevId }]" @click="navigateTo(content.prevId)">
                        <t-icon name="chevron-left" size="32rpx" />
                        <view class="nav-content">
                            <text class="nav-label">上一篇</text>
                            <text class="nav-title">{{ content.prevTitle || '没有了' }}</text>
                        </view>
                    </view>
                    <view class="nav-divider" />
                    <view :class="['nav-item', { disabled: !content.nextId }]" @click="navigateTo(content.nextId)">
                        <view class="nav-content" style="text-align: right;">
                            <text class="nav-label">下一篇</text>
                            <text class="nav-title">{{ content.nextTitle || '没有了' }}</text>
                        </view>
                        <t-icon name="chevron-right" size="32rpx" />
                    </view>
                </view>
            </view>

            <!-- 底部操作栏 -->
            <view class="footer">
                <view class="footer-btn" @click="handleShare">
                    <t-icon name="share" size="44rpx" />
                    <text>分享</text>
                </view>
            </view>
        </view>
    </PageLayout>
</template>

<style lang="scss" scoped>
.detail-page {
    min-height: 100vh;
    background: #fff;
    padding-bottom: 120rpx; // 留出底部操作栏空间
}

// 加载状态
.loading-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 200rpx 0;
}

.loading-text {
    margin-top: 20rpx;
    color: #999;
    font-size: 26rpx;
}

// 错误状态
.error-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 200rpx 0;
    gap: 24rpx;
}

.error-text {
    color: #666;
    font-size: 28rpx;
}

// 未登录提示
.login-tip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    padding: 16rpx;
    background: #fff3e0;
    color: #f57c00;
    font-size: 24rpx;
}

// 内容区域
.content-wrap {
    padding: 0 32rpx;
}

// 标题区域
.header {
    padding: 32rpx 0;
    border-bottom: 1rpx solid #eee;
}

.title {
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
    line-height: 1.5;
    margin-bottom: 24rpx;
}

.meta {
    display: flex;
    align-items: center;
    gap: 24rpx;
    font-size: 24rpx;
    color: #999;
}

.author {
    color: #0052d9;
}

// 正文
.article {
    padding: 32rpx 0;
    font-size: 30rpx;
    line-height: 1.8;
    color: #333;

    :deep(p) {
        margin-bottom: 24rpx;
    }

    :deep(img) {
        max-width: 100%;
        height: auto;
    }

    :deep(table) {
        width: 100%;
        border-collapse: collapse;

        td,
        th {
            border: 1rpx solid #ddd;
            padding: 12rpx;
        }
    }
}

// 附件
.attachments {
    padding: 24rpx 0;
    border-top: 1rpx solid #eee;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 28rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 16rpx;
}

.attachment-item {
    display: flex;
    align-items: center;
    padding: 20rpx 24rpx;
    background: #f8f8f8;
    border-radius: 12rpx;
    margin-bottom: 12rpx;
}

.att-name {
    flex: 1;
    margin-left: 12rpx;
    font-size: 26rpx;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.download-icon {
    color: #0052d9;
}

// 上一篇/下一篇
.navigation {
    display: flex;
    align-items: stretch;
    padding: 32rpx 0;
    border-top: 1rpx solid #eee;
}

.nav-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 16rpx;

    &.disabled {
        opacity: 0.5;
        pointer-events: none;
    }
}

.nav-divider {
    width: 1rpx;
    background: #eee;
}

.nav-content {
    flex: 1;
    min-width: 0;
}

.nav-label {
    display: block;
    font-size: 22rpx;
    color: #999;
    margin-bottom: 8rpx;
}

.nav-title {
    display: block;
    font-size: 26rpx;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

// 底部操作栏
.footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    padding: 20rpx 32rpx;
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
    background: #fff;
    border-top: 1rpx solid #eee;
}

.footer-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
    padding: 12rpx 32rpx;
    color: #666;
    font-size: 22rpx;
}
</style>