<!--
  红点/角标组件
  
  文件：src/components/common/BadgeDot.vue
  
  使用：
  <BadgeDot :count="5">
    <t-icon name="notification" />
  </BadgeDot>
-->
<template>
    <view class="badge-container">
        <slot />

        <!-- 红点（无数字） -->
        <view v-if="dot && showBadge" class="badge-dot" :style="dotStyle" />

        <!-- 数字角标 -->
        <view v-else-if="showBadge" class="badge-count" :style="countStyle">
            {{ displayCount }}
        </view>
    </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
    /** 未读数 */
    count?: number
    /** 最大显示数 */
    max?: number
    /** 只显示红点（不显示数字） */
    dot?: boolean
    /** 偏移量 */
    offset?: [number, number]
    /** 自定义颜色 */
    color?: string
}>(), {
    count: 0,
    max: 99,
    dot: false,
    offset: () => [0, 0],
    color: '#f54a45'
})

const showBadge = computed(() => props.count > 0)

const displayCount = computed(() => {
    if (props.count > props.max) {
        return `${props.max}+`
    }
    return props.count.toString()
})

const dotStyle = computed(() => ({
    backgroundColor: props.color,
    top: `${-4 + props.offset[1]}rpx`,
    right: `${-4 + props.offset[0]}rpx`,
}))

const countStyle = computed(() => ({
    backgroundColor: props.color,
    top: `${-8 + props.offset[1]}rpx`,
    right: `${-8 + props.offset[0]}rpx`,
}))
</script>

<style lang="scss" scoped>
.badge-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.badge-dot {
    position: absolute;
    top: -4rpx;
    right: -4rpx;
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
    z-index: 1;
}

.badge-count {
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    min-width: 32rpx;
    height: 32rpx;
    padding: 0 8rpx;
    font-size: 20rpx;
    font-weight: 500;
    color: #fff;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    box-sizing: border-box;
}
</style>