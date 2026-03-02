<!--
  首页（重构版）
  
  文件：src/pages/home/index.vue
  
  改进点：
  1. 使用 useAuthGuard 统一认证入口
  2. 全局遮罩自动处理，无需页面内 loading 状态
  3. 简化逻辑，页面只关注业务
-->

<template>
  <view class="home">
    <!-- 用户区域：点击头像触发登录检查 -->
    <view class="user-card" @tap="handleAvatarClick">
      <image class="avatar" :src="userStore.userInfo?.avatarURL || '/static/logo.png'" mode="aspectFill" />
      <view class="user-info">
        <!-- 已登录状态 -->
        <template v-if="userStore.isSchoolLoggedIn && userStore.userInfo">
          <text class="name">{{ userStore.userInfo.realName || userStore.userInfo.userId }}</text>
          <text class="hint">{{ userStore.userInfo.schoolName || '已登录' }}</text>
        </template>
        <!-- 未登录状态 -->
        <template v-else>
          <text class="name">未登录</text>
          <text class="hint">点击登录校园服务</text>
        </template>
      </view>
      <view class="arrow">
        <t-icon name="chevron-right" size="40rpx" color="#999" />
      </view>
    </view>

    <!-- Cookie 即将过期提醒 -->
    <view v-if="userStore.cookieExpiringSoon" class="warning-banner" @tap="handleRefreshSession">
      <t-icon name="info-circle" size="32rpx" />
      <text>登录状态即将过期，点击刷新</text>
    </view>

    <!-- 功能入口 -->
    <view class="section">
      <text class="section-title">校园服务</text>
      <t-cell-group>
        <t-cell title="我的课表" note="查看本周课程安排" arrow @click="goSchedule">
          <template #left-icon>
            <t-icon name="calendar" size="48rpx" color="#1976d2" />
          </template>
        </t-cell>
        <t-cell title="校园公告" note="查看学校最新通知" arrow @click="goNotice">
          <template #left-icon>
            <t-icon name="notification" size="48rpx" color="#ff9800" />
          </template>
        </t-cell>
        <t-cell title="活动日历" note="校园活动一览" arrow @click="goCalendar">
          <template #left-icon>
            <t-icon name="time" size="48rpx" color="#4caf50" />
          </template>
        </t-cell>
      </t-cell-group>
    </view>

    <!-- 关于 -->
    <view class="section">
      <text class="section-title">关于</text>
      <t-cell-group>
        <t-cell title="版本信息" note="v0.0.3" />
      </t-cell-group>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 首页
 */
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'
import { useAuthGuard } from '@/composables/useAuthGuard'

const userStore = useUserStore()
const { ensure, isSchoolLoggedIn } = useAuthGuard()

// ==================== 生命周期 ====================

// 页面显示时，静默检查认证状态（不强制要求登录）
onShow(async () => {
  // 首页不强制要求登录学校，只检查 Token
  await ensure({
    requireSchoolLogin: false,
    silent: true  // 静默模式，不显示遮罩
  })
})

// ==================== 事件处理 ====================

/**
 * 点击头像：检查登录状态
 */
async function handleAvatarClick() {
  if (userStore.isSchoolLoggedIn) {
    // 已登录，可以跳转到个人中心或显示信息
    uni.showToast({ title: '已登录', icon: 'success' })
  } else {
    // 未登录，执行完整认证检查
    const result = await ensure({
      requireSchoolLogin: true,
      redirectOnFail: true
    })

    if (result.success) {
      uni.showToast({ title: '登录成功', icon: 'success' })
    }
    // 失败的情况已经在 ensure 中处理（跳转登录页或显示错误弹窗）
  }
}

/**
 * 刷新会话
 */
async function handleRefreshSession() {
  try {
    await userStore.refreshSession()
    uni.showToast({ title: '刷新成功', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: '刷新失败', icon: 'error' })
  }
}

/**
 * 跳转课表页
 */
function goSchedule() {
  uni.switchTab({ url: '/pages/schedule/index' })
}

/**
 * 跳转公告页
 */
function goNotice() {
  uni.switchTab({ url: '/pages/notice/index' })
}

/**
 * 跳转日历页
 */
function goCalendar() {
  uni.navigateTo({ url: '/pages/calendar/index' })
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
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  font-size: 24rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  flex-shrink: 0;
  margin-left: 16rpx;
}

.warning-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 24rpx;
  background: #fff3cd;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
  color: #856404;
  font-size: 26rpx;
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
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

:deep(.t-cell) {
  padding: 24rpx 0;
}

:deep(.t-cell__left-icon) {
  margin-right: 20rpx;
}
</style>