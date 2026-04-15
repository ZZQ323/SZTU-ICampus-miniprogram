<!--
  信息列表项组件
  
  文件：src/components/info/InfoListItem.vue
  
  ⭐ 改动：
  1. 标签颜色按 channelId（不再按 categoryCode，解决非公告频道全黑问题）
  2. 标签文字优先显示 source（数据源名称，如"教学动态"），而非 categoryName
  3. 外链文章显示"外链"角标
-->
<template>
    <view class="info-item" :class="{ 'is-read': isReadState }" @tap="handleTap">
        <!-- 未读指示器 -->
        <view v-if="!isReadState" class="unread-indicator" />

        <!-- 内容区域 -->
        <view class="item-content">
            <!-- 顶部：来源标签 + 日期 -->
            <view class="item-header">
                <view class="tag-row">
                    <!-- ⭐ 来源标签：颜色按频道，文字按来源 -->
                    <view v-if="tagText" class="source-tag" :style="{ backgroundColor: tagColor }">
                        {{ tagText }}
                    </view>
                    <!-- 外链角标 -->
                    <view v-if="isExternal" class="external-badge">外链</view>
                </view>
                <text class="item-date">{{ item.publishDate }}</text>
            </view>

            <!-- 标题 -->
            <view class="item-title">{{ cleanTitle }}</view>

            <!-- 底部：发文单位 + 箭头 -->
            <view class="item-footer">
                <text class="item-source">{{ item.department || '' }}</text>
                <view class="item-icons">
                    <t-icon v-if="item.hasAttachment" name="attach" size="28rpx" class="attach-icon" />
                    <t-icon :name="isExternal ? 'link' : 'chevron-right'" size="32rpx" class="arrow-icon" />
                </view>
            </view>
        </view>
    </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInfoStore } from '@/store/modules/info'
import type { InfoItemMeta } from '@/types/info'

// ==================== 频道颜色映射 ====================

const CHANNEL_COLOR_MAP: Record<string, string> = {
    'announcement': '#0052d9',     // 蓝色 - 校园公告
    'academic': '#07c160',         // 绿色 - 教务信息
    'campus-life': '#ff976a',      // 橙色 - 校园生活
    'news': '#9c27b0',             // 紫色 - 学校新闻
    // 预留
    'job': '#f5a623',              // 金色 - 就业信息
    'admission': '#e91e63',        // 粉色 - 招生信息
    'research': '#00bcd4',         // 青色 - 科研实训
    'department': '#607d8b',       // 灰蓝 - 职能部门
    'college': '#795548',          // 棕色 - 学院
}

// 公文通子分类的颜色（仅在 announcement 频道内细分）
const GWT_CATEGORY_COLOR: Record<string, string> = {
    '1018': '#0052d9',  // 教务
    '1019': '#07c160',  // 科研
    '1020': '#fa5151',  // 行政
    '1021': '#ff976a',  // 学工
    '1022': '#9c27b0',  // 校园
}

// ==================== Props ====================

const props = defineProps<{
    item: InfoItemMeta & {
        department?: string
        category?: string
    }
    useStore?: boolean
    isRead?: boolean
}>()

const emit = defineEmits<{
    tap: [item: typeof props.item]
}>()

// ==================== Store ====================

const infoStore = useInfoStore()

// ==================== 计算属性 ====================

const isReadState = computed(() => {
    if (props.isRead !== undefined) return props.isRead
    if (props.useStore === false) return false
    const channelId = props.item.channelId || 'announcement'
    return infoStore.isItemRead(channelId, props.item.id)
})

/** ⭐ 标签文字：组织名称·分类名称（如 "科研部·通知公告"） */
const tagText = computed(() => {
    const orgName = props.item.sourceOrgName
    const catName = props.item.categoryName || props.item.source
    if (orgName && catName) return `${orgName}·${catName}`
    if (orgName) return orgName
    if (catName) return catName
    if (props.item.source) return props.item.source
    return ''
})

/** ⭐ 标签颜色：公告频道按子分类细分，其他频道按 channelId */
const tagColor = computed(() => {
    const channelId = props.item.channelId || 'announcement'

    // 公告频道：按 categoryCode 细分颜色（教务蓝/科研绿/行政红/学工橙/校园紫）
    if (channelId === 'announcement') {
        const code = props.item.categoryCode || props.item.category
        if (code && GWT_CATEGORY_COLOR[code]) {
            return GWT_CATEGORY_COLOR[code]
        }
    }

    // 其他频道：按 channelId 统一颜色
    return CHANNEL_COLOR_MAP[channelId] || '#666'
})

/** 是否外链文章 */
const isExternal = computed(() => {
    return props.item.extra?.includes('"external"') ?? false
})

/** 清理标题（去掉开头的点号等） */
const cleanTitle = computed(() => {
    let title = props.item.title || ''
    // 去掉开头的 ". " 或 "· "
    title = title.replace(/^[.·]\s*/, '')
    return title
})

// ==================== 方法 ====================

function handleTap() {
    if (props.useStore !== false) {
        const channelId = props.item.channelId || 'announcement'
        infoStore.markItemRead(channelId, props.item.id)
    }
    emit('tap', props.item)
}
</script>

<style lang="scss" scoped>
.info-item {
    display: flex;
    align-items: stretch;
    padding: 24rpx 32rpx 24rpx 24rpx;
    background-color: #fff;
    border-radius: 16rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
    position: relative;
    transition: all 0.2s;

    &:active {
        background-color: #f5f5f5;
    }

    &.is-read {
        .item-title {
            color: #999;
        }

        .unread-indicator {
            display: none;
        }
    }
}

.unread-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6rpx;
    background-color: #0052d9;
    border-radius: 3rpx 0 0 3rpx;
}

.item-content {
    flex: 1;
    min-width: 0;
    padding-left: 8rpx;
}

.item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12rpx;
}

.tag-row {
    display: flex;
    align-items: center;
    gap: 8rpx;
}

.source-tag {
    font-size: 22rpx;
    padding: 4rpx 12rpx;
    border-radius: 4rpx;
    color: #fff;
    white-space: nowrap;
}

/* ⭐ 外链角标 */
.external-badge {
    font-size: 20rpx;
    padding: 2rpx 8rpx;
    border-radius: 4rpx;
    color: #fa5151;
    background: #fff0f0;
    border: 1rpx solid #fa5151;
    white-space: nowrap;
}

.item-date {
    font-size: 24rpx;
    color: #999;
    flex-shrink: 0;
}

.item-title {
    font-size: 30rpx;
    color: #333;
    line-height: 1.5;
    margin-bottom: 12rpx;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
}

.item-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.item-source {
    font-size: 24rpx;
    color: #666;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-icons {
    display: flex;
    align-items: center;
    gap: 8rpx;
    flex-shrink: 0;
}

.attach-icon {
    color: #0052d9;
}

.arrow-icon {
    color: #ccc;
}
</style>