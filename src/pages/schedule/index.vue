<template>
  <view class="schedule">
    <t-empty description="课表功能开发中" />
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { checkTabAuth } from '@/utils/router'

// TabBar 页面的权限检查（switchTab 不能被拦截器捕获）
onShow(() => {
  checkTabAuth()
})
</script>

<style lang="scss" scoped>
.schedule {
  padding: 60rpx 30rpx;
  display: flex;
  justify-content: center;
}
</style>
