<script setup lang="ts">
/**
 * 公告详情页
 *
 * 文件：src/pages/notice/detail.vue
 *
 * ⭐ 改动：
 * 1. rich-text 排版：前端 HTML 预处理注入 inline style（小程序不支持 :deep 穿透）
 * 2. 上下篇：基于 notice.vue 缓存的列表导航，不依赖后端 prev/next 解析
 * 3. 公文通需要登录才能查看
 */
import { ref, computed } from 'vue'
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
const channelId = ref('announcement')

// ==================== 状态 ====================

const loading = ref(true)
const content = ref<InfoContent | null>(null)
const error = ref('')

// ==================== 列表导航（上一篇/下一篇） ====================

interface NavItem { id: string; title: string; channelId: string; categoryCode: string }
const navList = ref<NavItem[]>([])

const currentIndex = computed(() => navList.value.findIndex(i => i.id === id.value))
const prevItem = computed(() => currentIndex.value > 0 ? navList.value[currentIndex.value - 1] : null)
const nextItem = computed(() =>
    currentIndex.value >= 0 && currentIndex.value < navList.value.length - 1
        ? navList.value[currentIndex.value + 1] : null
)

// ==================== 计算属性 ====================

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)

/** 是否是公文通频道（需要登录） */
const isAnnouncement = computed(() => channelId.value === 'announcement')

/** 经过标准化处理的正文 HTML（注入 inline style 供 rich-text 渲染） */
const normalizedContent = computed(() => {
    if (!content.value?.content) return ''
    return normalizeHtml(content.value.content)
})

// ==================== HTML 预处理（小程序 rich-text 专用） ====================

/**
 * 标准化 HTML：为 rich-text 组件注入 inline style
 *
 * 小程序的 rich-text 不支持外部 CSS 穿透（:deep 无效），
 * 不同来源的公文自带不同的 font-size/line-height，
 * 这里统一注入标准排版样式，确保所有来源的文章显示一致。
 */
function normalizeHtml(html: string): string {
    if (!html) return ''

    const pStyle = 'margin:0 0 16px 0;font-size:15px;line-height:1.8;color:#333;word-break:break-all;'
    const imgStyle = 'max-width:100%;height:auto;display:block;margin:8px 0;'
    const h1Style = 'font-size:20px;font-weight:bold;color:#333;margin:20px 0 12px 0;line-height:1.4;'
    const h2Style = 'font-size:18px;font-weight:bold;color:#333;margin:16px 0 10px 0;line-height:1.4;'
    const h3Style = 'font-size:16px;font-weight:bold;color:#333;margin:14px 0 8px 0;line-height:1.4;'
    const tableStyle = 'width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;'
    const tdStyle = 'border:1px solid #ddd;padding:8px;font-size:14px;line-height:1.6;word-break:break-all;'
    const spanBaseStyle = 'font-size:15px;line-height:1.8;'

    let result = html

    // 图片：移除固定宽高，注入响应式样式
    result = result.replace(/<img([^>]*?)>/gi, (match, attrs) => {
        let cleaned = attrs
            .replace(/\s*width\s*=\s*["'][^"']*["']/gi, '')
            .replace(/\s*height\s*=\s*["'][^"']*["']/gi, '')
        if (/style\s*=\s*["']/i.test(cleaned)) {
            cleaned = cleaned.replace(
                /style\s*=\s*["']([^"']*)["']/i,
                (_: string, s: string) => {
                    const c = s.replace(/width\s*:[^;]*(;|$)/gi, '').replace(/height\s*:[^;]*(;|$)/gi, '')
                    return `style="${c};${imgStyle}"`
                }
            )
        } else {
            cleaned += ` style="${imgStyle}"`
        }
        return `<img${cleaned}>`
    })

    // p 标签：统一字体和间距
    result = result.replace(/<p([^>]*?)>/gi, (match, attrs) => {
        if (/style\s*=\s*["']/i.test(attrs)) {
            return match.replace(
                /style\s*=\s*["']([^"']*)["']/i,
                (_: string, s: string) => `style="${s};font-size:15px;line-height:1.8;color:#333;"`
            )
        }
        return `<p${attrs} style="${pStyle}">`
    })

    // span 标签：覆盖来源自带的 font-size（统一为 15px）
    result = result.replace(/<span([^>]*?)>/gi, (match, attrs) => {
        if (/style\s*=\s*["']/i.test(attrs)) {
            return match.replace(
                /style\s*=\s*["']([^"']*)["']/i,
                (_: string, s: string) => {
                    const cleaned = s
                        .replace(/font-size\s*:[^;]*(;|$)/gi, '')
                        .replace(/font-family\s*:[^;]*(;|$)/gi, '')
                    return `style="${cleaned};${spanBaseStyle}"`
                }
            )
        }
        return match
    })

    // 标题标签
    result = result.replace(/<h1([^>]*?)>/gi, (_, attrs) => `<h1${attrs} style="${h1Style}">`)
    result = result.replace(/<h2([^>]*?)>/gi, (_, attrs) => `<h2${attrs} style="${h2Style}">`)
    result = result.replace(/<h3([^>]*?)>/gi, (_, attrs) => `<h3${attrs} style="${h3Style}">`)

    // 表格
    result = result.replace(/<table([^>]*?)>/gi, (_, attrs) => `<table${attrs} style="${tableStyle}">`)
    result = result.replace(/<td([^>]*?)>/gi, (_, attrs) => {
        if (/style\s*=\s*["']/i.test(attrs)) return `<td${attrs}>`
        return `<td${attrs} style="${tdStyle}">`
    })
    result = result.replace(/<th([^>]*?)>/gi, (_, attrs) => {
        if (/style\s*=\s*["']/i.test(attrs)) return `<th${attrs}>`
        return `<th${attrs} style="${tdStyle}font-weight:bold;background:#f5f5f5;">`
    })

    return result
}

// ==================== 方法 ====================

async function fetchDetail() {
    if (!id.value) {
        error.value = '参数错误'
        loading.value = false
        return
    }

    // 公文通需要登录
    if (isAnnouncement.value && !isLoggedIn.value) {
        error.value = '公文通内容需要登录后查看'
        loading.value = false
        return
    }

    loading.value = true
    error.value = ''

    try {
        const result = await infoApi.getDetail(id.value, channelId.value, category.value);
        content.value = {
            ...result,
            content: (result as any).htmlContent || result.content || '',
        }
    } catch (e: any) {
        console.error('[Detail] 获取详情失败', e)
        error.value = e.message || '加载失败'
    } finally {
        loading.value = false
    }
}

/** 跳转上一篇/下一篇（基于缓存列表） */
function navigateTo(item: NavItem | null) {
    if (!item) return
    uni.redirectTo({
        url: `/pages/notice/detail?id=${item.id}&channelId=${item.channelId}&category=${item.categoryCode}`
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
                    success: () => uni.hideLoading(),
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

function handleShare() {
    uni.showToast({ title: '请点击右上角分享', icon: 'none' })
}

// ==================== 生命周期 ====================

onLoad((options) => {
    if (options?.id) id.value = options.id
    if (options?.category) category.value = options.category
    if (options?.channelId) channelId.value = options.channelId

    // 读取列表缓存（上一篇/下一篇导航用）
    try {
        const cached = uni.getStorageSync('detail_nav_list')
        if (cached) navList.value = JSON.parse(cached)
    } catch { /* ignore */ }

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
                <t-button v-if="isAnnouncement && !isLoggedIn" theme="primary" size="small"
                    @click="() => uni.navigateTo({ url: '/pages/common/login/login' })">
                    去登录
                </t-button>
                <t-button v-else theme="primary" size="small" @click="fetchDetail">重试</t-button>
            </view>

            <!-- 内容 -->
            <view v-else-if="content" class="content-wrap">
                <!-- 标题区域 -->
                <view class="header">
                    <view v-if="content.title" class="title">{{ content.title }}</view>
                    <view class="meta">
                        <text v-if="content.author" class="author">{{ content.author }}</text>
                        <text v-if="content.publishTime" class="time">{{ content.publishTime }}</text>
                    </view>
                </view>

                <!-- 正文内容（使用预处理后的 HTML） -->
                <view class="article">
                    <rich-text :nodes="normalizedContent" />
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
            </view>

            <!-- ⭐ 底部固定栏：导航 + 分享（不再被内容挤压） -->
            <view class="bottom-bar">
                <!-- 上一篇/下一篇 -->
                <view v-if="navList.length > 0" class="navigation">
                    <view :class="['nav-item', 'nav-prev', { disabled: !prevItem }]"
                        @click="navigateTo(prevItem)">
                        <t-icon name="chevron-left" size="32rpx" />
                        <view class="nav-content">
                            <text class="nav-label">上一篇</text>
                            <text v-if="prevItem" class="nav-title">{{ prevItem.title }}</text>
                            <text v-else class="nav-empty">没有了</text>
                        </view>
                    </view>
                    <view class="nav-divider" />
                    <view :class="['nav-item', 'nav-next', { disabled: !nextItem }]"
                        @click="navigateTo(nextItem)">
                        <view class="nav-content" style="text-align: right;">
                            <text class="nav-label">下一篇</text>
                            <text v-if="nextItem" class="nav-title">{{ nextItem.title }}</text>
                            <text v-else class="nav-empty">没有了</text>
                        </view>
                        <t-icon name="chevron-right" size="32rpx" />
                    </view>
                </view>

                <!-- 分享 -->
                <view class="footer-actions">
                    <view class="footer-btn" @click="handleShare">
                        <t-icon name="share" size="40rpx" />
                        <text>分享</text>
                    </view>
                </view>
            </view>
        </view>
    </PageLayout>
</template>

<style lang="scss" scoped>
.detail-page {
    min-height: 100vh;
    background: #fff;
    padding-bottom: 280rpx; // 留出底部固定栏空间（导航 + 分享）
}

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
    text-align: center;
    padding: 0 48rpx;
}

.content-wrap {
    padding: 0 32rpx;
}

// 标题区域
.header {
    padding: 32rpx 0;
    border-bottom: 1rpx solid #eee;
}

.title {
    font-size: 38rpx;
    font-weight: 600;
    color: #333;
    line-height: 1.4;
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

// 正文容器（排版由 normalizeHtml 的 inline style 控制）
.article {
    padding: 32rpx 0;
    overflow: hidden;
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

// ⭐ 底部固定栏（导航 + 分享合并，不会被长内容遮挡）
.bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1rpx solid #eee;
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 10;
}

.navigation {
    display: flex;
    align-items: stretch;
    padding: 16rpx 24rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.nav-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 8rpx;
    min-width: 0;

    &.disabled {
        opacity: 0.4;
        pointer-events: none;
    }
}

.nav-divider {
    width: 1rpx;
    background: #eee;
    flex-shrink: 0;
}

.nav-content {
    flex: 1;
    min-width: 0;
}

.nav-label {
    display: block;
    font-size: 20rpx;
    color: #999;
    margin-bottom: 4rpx;
}

.nav-title {
    display: block;
    font-size: 22rpx;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.nav-empty {
    display: block;
    font-size: 22rpx;
    color: #ccc;
}

.footer-actions {
    display: flex;
    justify-content: center;
    padding: 12rpx 0;
}

.footer-btn {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8rpx;
    padding: 8rpx 32rpx;
    color: #666;
    font-size: 22rpx;
}
</style>
