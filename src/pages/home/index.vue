<!-- home.vue（修复版） -->
<template>
  <view class="home">
    <!-- 用户区域：点击头像触发登录检查 -->
    <view class="user-card" @tap="handleAvatarClick">
      <image class="avatar" :src="userStore.userInfo?.avatarURL || '/static/logo.png'" mode="aspectFill" />
      <view class="user-info">
        <!-- 已登录状态 -->
        <template v-if="userStore.isSchoolLoggedIn && userStore.userInfo">
          <text class="name">{{ userStore.userInfo.userId }}</text>
          <text class="hint" v-if="userStore.userInfo.realName">{{ userStore.userInfo.realName }}</text>
          <text class="hint" v-if="userStore.userInfo.schoolName">{{ userStore.userInfo.schoolName }}</text>
        </template>
        <!-- 未登录状态 -->
        <template v-else>
          <text class="name">未登录</text>
          <text class="hint">点击登录</text>
        </template>
      </view>
    </view>

    <!-- 功能入口 -->
    <view class="section">
      <text class="section-title">校园服务</text>
      <t-cell-group>
        <t-cell title="我的课表" arrow @click="goSchedule" />
        <t-cell title="校园公告" arrow @click="goNotice" />
        <t-cell title="活动通知" arrow @click="goCalendar" />
      </t-cell-group>
    </view>

    <!-- 调试信息（可删除） -->
    <view class="debug-section" v-if="false">
      <text>isSchoolLoggedIn: {{ userStore.isSchoolLoggedIn }}</text>
      <text>userInfo: {{ JSON.stringify(userStore.userInfo) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 首页（修复版）
 * 
 * 修复：
 * 1. :display 不是有效的 Vue 指令，改用 v-if
 * 2. 简化模板逻辑，使用 template + v-if/v-else
 */
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

// 点击头像：检查登录 → 跳转
async function handleAvatarClick() {
  if ( !userStore.isSchoolLoggedIn ) {
    uni.navigateTo({ url: '/pages/common/login/index' })
    return
  }

  try {
    const status = await userStore.checkSchoolSession()
    if (!status.logined) {
      uni.navigateTo({ url: '/pages/common/login/index' })
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

function goNotice() {
  uni.switchTab({ url: '/pages/notice/index' })
}

function goCalendar() {
  uni.switchTab({ url: '/pages/calendar/index' })
}
</script>

<style lang="scss" scoped>
.home {
  padding: 30rpx;
  background: #f5f5f5;
  min-height: 100vh;
}

.user-card {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
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
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
  display: block;
}

.debug-section {
  background: #fff3cd;
  padding: 20rpx;
  border-radius: 8rpx;
  font-size: 24rpx;

  text {
    display: block;
    margin-bottom: 8rpx;
  }
}
</style>