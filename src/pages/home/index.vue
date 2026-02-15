<template>
  <view class="home">
    <!-- 用户区域：点击头像触发登录检查 -->
    <view class="user-card" @tap="handleAvatarClick">
      <image
        class="avatar"
        :src="userStore.userInfo?.avatar || '/static/logo.png'"
        mode="aspectFill"
      />
      <view class="user-info">
        <text class="name">{{ userStore.userName }}</text>
        <text class="hint">{{ userStore.isLoggedIn ? '点击查看个人信息' : '点击登录' }}</text>
      </view>
    </view>

    <!-- TDesign 按钮测试 —— 如果这两个按钮能正常显示样式，说明 TDesign 配好了 -->
    <view class="section">
      <text class="section-title">TDesign 组件测试</text>
      <t-button theme="primary" size="large" block>主要按钮</t-button>
      <t-button theme="default" size="large" block style="margin-top: 20rpx">次要按钮</t-button>
    </view>

    <!-- 功能入口 -->
    <view class="section">
      <text class="section-title">校园服务</text>
      <t-cell-group>
        <t-cell title="我的课表" arrow @click="goSchedule" />
        <t-cell title="校园公告" arrow />
        <t-cell title="活动通知" arrow />
      </t-cell-group>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 首页
 *
 * 注意：页面只负责"交互"和"展示"
 * 具体的业务逻辑在 store 里，API 调用在 api/ 里
 * 这样这个页面就不会有几百行了
 */
import { useUserStore } from '@/store'

const userStore = useUserStore()

// 点击头像：检查登录 → 跳转
async function handleAvatarClick() {
  if (!userStore.isLoggedIn) {
    // 没登录，直接跳登录页
    uni.navigateTo({ url: '/pages/login/index' })
    return
  }

  try {
    const { needLogin, method } = await userStore.checkLogin()
    if (needLogin) {
      uni.navigateTo({ url: `/pages/login/index?method=${method}` })
    } else {
      uni.showToast({ title: '已登录', icon: 'success' })
    }
  } catch (e) {
    uni.showToast({ title: '检查失败', icon: 'none' })
  }
}

function goSchedule() {
  uni.switchTab({ url: '/pages/schedule/index' })
}
</script>

<style lang="scss" scoped>
.home {
  padding: 30rpx;
}
.user-card {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}
.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  margin-right: 24rpx;
  background: #eee;
}
.user-info {
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 8rpx;
}
.hint {
  font-size: 24rpx;
  color: #999;
}
.section {
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
  display: block;
}
</style>
