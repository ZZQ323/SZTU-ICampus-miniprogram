<!--
  悬浮通知球（基于推送队列的消息中心）

  文件：src/components/FloatingNotification.vue

  两态徽章（由 infoStore.badge 统一决定）：
    · number：队列非空，显示数字（登录态期间收到的推送）
    · dot：队列空但有未读文章
    · none：完全已读

  点击展开：
    · 队列非空 → 悬浮列表，每条可点（跳详情并 dismiss）或 ✗（只 dismiss），底部"全部已读"清空队列
    · 队列空但有红点 → 空态卡片 + "去信息流看看"
    · 完全已读 → 展开后仍是空态（给个兜底）
-->

<template>
    <view class="fab-wrapper">
        <!-- 展开的面板 -->
        <view v-if="isExpanded" class="fab-panel">
            <view class="panel-header">
                <text class="panel-title">最近推送</text>
                <view v-if="queue.length > 0" class="clear-btn" @tap="handleClearAll">
                    <text>全部已读</text>
                </view>
            </view>

            <!-- 队列列表 -->
            <scroll-view v-if="queue.length > 0" scroll-y class="panel-list">
                <view v-for="item in queue" :key="item.articleId" class="queue-item"
                    @tap="handleTapItem(item)">
                    <view class="item-icon">
                        <t-icon name="notification" size="32rpx" color="#0052d9" />
                    </view>
                    <view class="item-main">
                        <text class="item-title">{{ displayTitle(item) }}</text>
                        <text class="item-meta">{{ displaySource(item) }} · {{ displayTime(item.receivedAt) }}</text>
                    </view>
                    <view class="item-dismiss" @tap.stop="handleDismiss(item.articleId)">
                        <t-icon name="close" size="32rpx" color="#bbb" />
                    </view>
                </view>
            </scroll-view>

            <!-- 空态（队列空，不管有没有红点都展示引导） -->
            <view v-else class="panel-empty">
                <t-icon name="notification" size="80rpx" color="#ddd" />
                <text class="empty-text">最近无推送</text>
                <view class="go-notice-btn" @tap="goNotice">去信息流看看</view>
            </view>
        </view>

        <!-- 背景遮罩（点击关闭）-->
        <view v-if="isExpanded" class="fab-overlay" @tap="isExpanded = false" />

        <!-- 主按钮 -->
        <view class="fab-main" :class="{ 'is-expanded': isExpanded }" @tap="toggleExpand">
            <t-icon :name="isExpanded ? 'close' : 'notification'" size="44rpx" color="#fff" />

            <!-- 徽章：三态 -->
            <view v-if="!isExpanded && badge.mode === 'number'" class="fab-badge">
                {{ (badge.value || 0) > 99 ? '99+' : badge.value }}
            </view>
            <view v-else-if="!isExpanded && badge.mode === 'dot'" class="fab-badge-dot" />
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInfoStore, type ToastItem } from '@/store/modules/info'

const infoStore = useInfoStore()

const isExpanded = ref(false)

const queue = computed<ToastItem[]>(() => infoStore.toastQueue)
const badge = computed(() => infoStore.badge)

// ==================== 交互 ====================

function toggleExpand() {
    isExpanded.value = !isExpanded.value
}

let lastClickAt = 0
function handleTapItem(item: ToastItem) {
    const now = Date.now()
    if (now - lastClickAt < 400) return
    lastClickAt = now

    const ch = item.channelId || 'announcement'
    uni.navigateTo({
        url: `/pages/notice/detail?id=${item.articleId}&channelId=${ch}`,
        success: () => infoStore.dismissToast(item.articleId),
        fail: () => { /* 保留在队列里供用户重试 */ },
    })
    isExpanded.value = false
}

function handleDismiss(articleId: string) {
    infoStore.dismissToast(articleId)
}

function handleClearAll() {
    infoStore.clearToastQueue()
}

function goNotice() {
    uni.switchTab({ url: '/pages/notice/notice' })
    isExpanded.value = false
}

// ==================== 显示辅助 ====================

function displayTitle(item: ToastItem): string {
    if (item.title) return item.title
    return `${item.sourceOrgName || '新消息'} · 新动态`
}

function displaySource(item: ToastItem): string {
    return item.sourceOrgName || item.channelId || ''
}

function displayTime(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return '刚刚'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
    const d = new Date(ts)
    return `${d.getMonth() + 1}-${d.getDate()}`
}
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

.fab-badge-dot {
    position: absolute;
    top: 6rpx;
    right: 6rpx;
    width: 20rpx;
    height: 20rpx;
    background: #f54a45;
    border-radius: 50%;
    border: 2rpx solid #fff;
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

/* ==================== 展开面板 ==================== */

.fab-panel {
    position: absolute;
    bottom: 116rpx;
    right: 0;
    width: 560rpx;
    max-height: 720rpx;
    background: #fff;
    border-radius: 20rpx;
    box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.15);
    animation: fadeInUp 0.2s ease-out;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20rpx); }
    to   { opacity: 1; transform: translateY(0); }
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 28rpx;
    border-bottom: 1rpx solid #f0f0f0;
    flex-shrink: 0;
}

.panel-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
}

.clear-btn {
    padding: 6rpx 16rpx;
    font-size: 24rpx;
    color: #0052d9;
    background: #e6f0ff;
    border-radius: 20rpx;

    &:active {
        background: #d0e0ff;
    }
}

/* 列表 */

.panel-list {
    flex: 1;
    max-height: 560rpx;
    padding: 8rpx 0;
}

.queue-item {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 20rpx 24rpx;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child { border-bottom: none; }
    &:active { background: #f7f8fa; }
}

.item-icon {
    width: 56rpx;
    height: 56rpx;
    background: #e6f0ff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4rpx;
}

.item-title {
    font-size: 26rpx;
    color: #333;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.item-meta {
    font-size: 22rpx;
    color: #999;
}

.item-dismiss {
    padding: 8rpx;
    flex-shrink: 0;

    &:active {
        background: #f0f0f0;
        border-radius: 50%;
    }
}

/* 空态 */

.panel-empty {
    padding: 60rpx 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16rpx;
}

.empty-text {
    font-size: 28rpx;
    color: #999;
}

.go-notice-btn {
    margin-top: 12rpx;
    padding: 14rpx 40rpx;
    background: #0052d9;
    color: #fff;
    font-size: 26rpx;
    border-radius: 24rpx;

    &:active {
        background: #003ea5;
    }
}
</style>
