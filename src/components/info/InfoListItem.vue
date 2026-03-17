<!--
  信息列表项组件
  
  文件：src/components/info/InfoListItem.vue
  
  功能：
  - 显示已读/未读状态
  - 未读显示蓝色指示器
  - 已读标题变灰
-->
<template>
    <view class="info-item" :class="{ 'is-read': isReadState }" @tap="handleTap">
        <!-- 未读指示器 -->
        <view v-if="!isReadState" class="unread-indicator" />

        <!-- 内容区域 -->
        <view class="item-content">
            <!-- 顶部：分类标签 + 日期 -->
            <view class="item-header">
                <view v-if="item.categoryName" class="category-tag" :style="{ backgroundColor: categoryColor }">
                    {{ item.categoryName }}
                </view>
                <text class="item-date">{{ item.publishDate }}</text>
            </view>

            <!-- 标题 -->
            <view class="item-title">{{ item.title }}</view>

            <!-- 底部：来源 + 附件图标 -->
            <view class="item-footer">
                <text class="item-source">{{ item.sourceName || item.department }}</text>
                <view class="item-icons">
                    <t-icon v-if="item.hasAttachment" name="attach" size="28rpx" class="attach-icon" />
                    <t-icon name="chevron-right" size="32rpx" class="arrow-icon" />
                </view>
            </view>
        </view>
    </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInfoStore } from '@/store/modules/info'
import { CATEGORY_COLOR_MAP } from '@/types/info'
import type { InfoItemMeta } from '@/types/info'

// ==================== Props ====================

const props = defineProps<{
    item: InfoItemMeta & {
        department?: string  // 兼容旧字段
        category?: string    // 兼容旧字段
    }
    /** 是否使用 store 判断已读（默认 true） */
    useStore?: boolean
    /** 手动指定是否已读 */
    isRead?: boolean
}>()

const emit = defineEmits<{
    tap: [item: typeof props.item]
}>()

// ==================== Store ====================

const infoStore = useInfoStore()

// ==================== 计算属性 ====================

/** 是否已读 */
const isReadState = computed(() => {
    // 如果手动指定了 isRead，使用手动值
    if (props.isRead !== undefined) {
        return props.isRead
    }

    // 如果不使用 store，默认未读
    if (props.useStore === false) {
        return false
    }

    // 使用 store 判断
    const channelId = props.item.channelId || 'announcement'
    return infoStore.isItemRead(channelId, props.item.id)
})

/** 分类颜色 */
const categoryColor = computed(() => {
    const code = props.item.categoryCode || props.item.category
    if (code && CATEGORY_COLOR_MAP[code]) {
        return CATEGORY_COLOR_MAP[code]
    }
    return '#666'
})

// ==================== 方法 ====================

function handleTap() {
    // 标记已读
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

    // 已读状态：标题变灰，去掉左边框
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

.category-tag {
    font-size: 22rpx;
    padding: 4rpx 12rpx;
    border-radius: 4rpx;
    color: #fff;
}

.item-date {
    font-size: 24rpx;
    color: #999;
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