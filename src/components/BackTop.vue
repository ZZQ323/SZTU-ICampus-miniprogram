<!--
  回到顶部按钮。
  - 位置：右下，FAB 正上方（bottom 340rpx，避开 FAB 的 200rpx + 其高度）
  - 仅在 :visible=true 时渲染 —— 交给调用方通过 useBackTop 控制
  - 点击触发 @tap 事件，调用方 scrollToTop()
-->
<script setup lang="ts">
defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'tap'): void }>()
</script>

<template>
  <view v-if="visible" class="back-top" @tap="emit('tap')" hover-class="back-top-active">
    <t-icon name="arrow-up" size="40rpx" color="#0052d9" />
  </view>
</template>

<style lang="scss" scoped>
.back-top {
  position: fixed;
  right: 32rpx;
  bottom: 340rpx;   /* FAB 主按钮在 bottom:200rpx + 高度~80rpx，此处 +60 留距 */
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
  z-index: 999;       /* 低于 FAB 的 1000，避免遮盖 FAB 展开的菜单 */
}

.back-top-active {
  background: #f0f4fa;
  transform: scale(0.92);
}
</style>
