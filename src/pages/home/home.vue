<!--
  首页（改进版 - 等待认证完成后才显示内容）
  
  文件：src/pages/home/index.vue
  
  改动点：
  1. 使用 v-if="isReady" 控制内容显示
  2. 认证检查完成前显示遮罩
  3. 跳转登录页前确保 loginTypes 已获取
-->

<template>
  <PageLayout>
    <!-- ⭐ 关键：只有认证就绪后才显示页面内容 -->
    <view v-if="isReady" class="home">
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
        <template v-if="userStore.isSchoolLoggedIn && userStore.userInfo">
          <t-button size="small" theme="light" @click.stop="handleLogout">退出登录</t-button>
        </template>
        <view class="arrow">
          <t-icon name="chevron-right" size="40rpx" color="#999" />
        </view>
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
          <t-cell title="版本信息" note="v0.0.4" />
        </t-cell-group>
      </view>

      <!-- 登出确认弹窗 -->
      <t-dialog :visible="showLogoutConfirm" title="退出登录" content="确定要退出登录吗？" confirm-btn="确定" cancel-btn="取消"
        @confirm="confirmLogout" @cancel="showLogoutConfirm = false" />
    </view>

    <FloatingNotification />
  </PageLayout>
</template>

<script setup lang="ts">
/**
 * 首页（改进版）
 * 
 * 使用 isReady 控制内容显示，确保认证信息完全到达后才渲染
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import FloatingNotification from "@/components/FloatingNotification.vue"
import { useUserStore } from '@/store/modules/user'
import { useAuthGuard } from '@/hooks/composables/useAuthGuard'

const userStore = useUserStore()
const { ensure, isReady } = useAuthGuard()

// ==================== 生命周期 ====================

/**
 * 页面显示时进行认证检查
 * 
 * ⭐ 改进设计：
 * - 不传 silent: true，会显示遮罩
 * - 等待 ensure 完成后，isReady 才会变为 true
 * - 页面内容使用 v-if="isReady" 控制，确保信息完全到达后才显示
 */
onShow(async () => {
  await ensure({
    requireSchoolLogin: false,  // 不强制登录
    // 不传 silent，使用遮罩
  })
})

// ==================== 事件处理 ====================

/**
 * 点击头像：跳转登录
 * 
 * ⭐ 改进：loginTypes 已经在 ensure 时获取，直接使用
 */
async function handleAvatarClick() {
  if (userStore.isSchoolLoggedIn) {
    uni.showToast({ title: '已登录', icon: 'success' })
  } else {
    // loginTypes 已经通过 ensure 获取，存储在 userStore 中
    const loginTypesParam = userStore.loginTypes?.join(',') || 'SMS'
    uni.navigateTo({
      url: `/pages/common/login/login?loginTypes=${loginTypesParam}`
    })
  }
}

// 显示登出确认
const showLogoutConfirm = ref(false)

function handleLogout() {
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await userStore.logoutSchool()
  uni.showToast({ title: '已退出登录', icon: 'success' })
}

// ==================== 页面跳转 ====================

function goSchedule() {
  uni.switchTab({ url: '/pages/schedule/schedule' })
}

function goNotice() {
  uni.switchTab({ url: '/pages/notice/notice' })
}

function goCalendar() {
  uni.navigateTo({ url: '/pages/calendar/calendar' })
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