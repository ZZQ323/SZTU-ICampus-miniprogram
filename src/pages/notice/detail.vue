<script setup lang="ts">
/**
 * 公告详情页
 *
 * 文件：src/pages/notice/detail.vue
 *
 * ⭐ 改动：rich-text → mp-html（支持图片预览 + 链接可点）
 *   小程序原生 rich-text 不支持事件系统（图片点不了、链接点不了）。
 *   mp-html 库把 HTML 解析为小程序组件树，内置：
 *     · <image> 点击自动 uni.previewImage（左右滑切换同文内图片）
 *     · <a> 点击触发 linktap 事件，由我们决定外链怎么打开
 *   tag-style 属性替代 normalizeHtml 的 regex 注入，更稳。
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

/**
 * 把文本中裸露的 http(s):// URL 包装成 <a>，让 mp-html 能识别为可点击链接。
 * <p>
 * 踩坑：学校公文里的 URL 往往是 Word/Office 粘贴带过来的，表现为带下划线的 <span>
 * 而非真正的 <a>，mp-html 默认不会把它当链接。这里用正则兜住 95% 的场景：
 *   · 仅匹配"HTML 标签外"的 URL（前面是 >, 空白, 或开头），避开 href="..." 里的 URL
 *   · 匹配到就包一层 <a href="URL">URL</a>，mp-html 会正常渲染并触发 linktap
 * <p>
 * 局限：
 *   · 不处理 <a> 包裹的嵌套（罕见）
 *   · 中文标点作为终止符（避免把后面的全角标点吃进 URL）
 */
function linkifyPlainUrls(html: string): string {
    if (!html) return ''
    // 前导断言：>、空白、行首；URL 体：排除空白/尖括号/引号/中文常见标点
    return html.replace(
        /(>|\s|^)(https?:\/\/[^\s<"'，。、；？！)）】]+)/g,
        (_m, before, url) => `${before}<a href="${url}">${url}</a>`
    )
}

const renderedContent = computed(() => linkifyPlainUrls(content.value?.content || ''))

// ==================== mp-html 配置 ====================

/**
 * mp-html 的 tag-style：按 HTML 标签名为其注入默认内联样式。
 * 替代旧的 normalizeHtml 正则字符串替换，完全交给 mp-html 的 AST 渲染器处理。
 * 特定标签的 inline style 仍然会叠加，不会丢失原文作者的样式。
 */
const TAG_STYLE = {
    p: 'margin:0 0 16px 0;font-size:15px;line-height:1.8;color:#333;word-break:break-all;',
    h1: 'font-size:20px;font-weight:bold;color:#333;margin:20px 0 12px 0;line-height:1.4;',
    h2: 'font-size:18px;font-weight:bold;color:#333;margin:16px 0 10px 0;line-height:1.4;',
    h3: 'font-size:16px;font-weight:bold;color:#333;margin:14px 0 8px 0;line-height:1.4;',
    h4: 'font-size:15px;font-weight:bold;color:#333;margin:12px 0 6px 0;line-height:1.4;',
    h5: 'font-size:15px;font-weight:bold;color:#333;margin:12px 0 6px 0;line-height:1.4;',
    h6: 'font-size:15px;font-weight:bold;color:#333;margin:12px 0 6px 0;line-height:1.4;',
    table: 'width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;',
    td: 'border:1px solid #ddd;padding:8px;font-size:14px;line-height:1.6;word-break:break-all;',
    th: 'border:1px solid #ddd;padding:8px;font-size:14px;line-height:1.6;font-weight:bold;background:#f5f5f5;',
    a: 'color:#0052d9;word-break:break-all;',
    img: 'max-width:100%;height:auto;display:block;margin:8px 0;',
}

// ==================== 方法 ====================

/**
 * 链接点击：mp-html 把 <a> 的点击通过 linktap 事件派发到这里。
 * 我们按链接类型分级处理：
 *   · mp.weixin.qq.com → 小程序内 web-view 打开（仅业务域名合法时生效）
 *   · 其他外链 → 复制剪贴板 + 提示
 *   · 返回 false 会阻止 mp-html 的默认行为（默认是复制）
 */
function onLinkTap(e: any) {
    const url = e?.href || e?.detail?.href || e?.ownerInstance?.href || ''
    if (!url) return
    if (url.includes('mp.weixin.qq.com')) {
        uni.navigateTo({
            url: `/pages/common/webview/webview?url=${encodeURIComponent(url)}`,
            fail: () => uni.setClipboardData({
                data: url,
                success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
            }),
        })
    } else {
        uni.setClipboardData({
            data: url,
            success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
        })
    }
}

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
        // 学校页面常见失败：404（链接已失效）/ 连接超时（如 nbw.sztu.edu.cn 时灵时不灵）
        // 直接弹 modal + 自动返回，避免演示时停在错误页。重试可重新点列表项。
        uni.showModal({
            title: '该文章无法访问',
            content: '可能是学校页面已下线或临时不可达，可稍后重试。',
            showCancel: false,
            confirmText: '返回',
            success: () => uni.navigateBack({ fail: () => {} })
        })
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

                <!-- 正文：使用 mp-html 渲染（图片点开预览，链接自定义处理）-->
                <view class="article">
                    <view v-if="!renderedContent" class="empty-content-hint">
                        <t-icon name="info-circle" size="60rpx" color="#ccc" />
                        <text>此消息无详情内容</text>
                    </view>
                    <mp-html
                        v-else
                        :content="renderedContent"
                        :tag-style="TAG_STYLE"
                        :selectable="true"
                        :lazy-load="true"
                        scroll-table
                        @linktap="onLinkTap"
                    />
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

            <!-- 回到顶部 -->
            <t-back-top :fixed="true" text="顶部" />

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

// 正文容器（排版由 mp-html 的 tag-style 控制）
.article {
    padding: 32rpx 0;
    overflow: hidden;
}

.empty-content-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
    padding: 80rpx 0;
    color: #aaa;
    font-size: 28rpx;
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
