<!--
  首页（改进版 - 使用 useAuth hook）
  
  文件：src/pages/home/home.vue
  
  功能：
  1. 使用 v-if="isReady" 控制内容显示
  2. 点击头像时强制检查登录状态（使用 useAuth）
  3. 如果登录已过期，提示并跳转登录页
-->

<template>
  <PageLayout>
    <!-- ⭐关键：只有认证就绪后才显示页面内容 -->
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
          <t-cell title="版本信息" note="v0.0.3" />
          <!-- 更新会话按钮 -->
          <t-cell title="刷新会话" note="提示会话异常时点击" arrow @click="handleResetSession">
            <template #left-icon>
              <t-icon name="refresh" size="48rpx" color="#f44336" />
            </template>
          </t-cell>
        </t-cell-group>
      </view>

      <!-- 重置确认弹窗 -->
      <t-dialog :visible="showResetConfirm" title="更新会话" content="将清除所有登录状态并重新初始化，确定继续吗？" confirm-btn="确定"
        cancel-btn="取消" @confirm="confirmResetSession" @cancel="showResetConfirm = false" />

      <!-- 登出确认弹窗 -->
      <t-dialog :visible="showLogoutConfirm" title="退出登录" content="确定要退出登录吗？" confirm-btn="确定" cancel-btn="取消"
        @confirm="confirmLogout" @cancel="showLogoutConfirm = false" />

      <!-- 登录过期弹窗 -->
      <t-dialog :visible="showExpiredDialog" title="登录已过期" content="需要重新登录，是否前往登录页？" confirm-btn="去登录" cancel-btn="取消"
        @confirm="handleGoLogin" @cancel="showExpiredDialog = false" />
    </view>

    <FloatingNotification />
  </PageLayout>
</template>

<script setup lang="ts">

/**
 * 首页（改进版）
 * 使用 useAuth hook 实现点击头像强制检查
 */

import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import FloatingNotification from "@/components/FloatingNotification.vue"
import { useUserStore } from '@/store/modules/user'
import { useAuthStore } from '@/store/modules/auth'
import { useAuthGuard } from '@/hooks/composables/useAuthGuard'
import { useAuth } from '@/hooks/useAuth'

const userStore = useUserStore()
const authStore = useAuthStore()
const { ensure, isReady } = useAuthGuard()
const { checkStatusWithUI, goLogin } = useAuth()

// ==================== 状态 ====================

const showLogoutConfirm = ref(false)
const showResetConfirm = ref(false)
const showExpiredDialog = ref(false)  // ⭐ 新增：登录过期弹窗

// ==================== 生命周期 ====================

/**
 * 页面显示时进行认证检查
 */
onShow(async () => {
  await ensure({
    requireSchoolLogin: false,  // 不强制登录
  })
})

// ==================== 事件处理 ====================

/**
 * 点击头像
 * 
 * - 如果已登录，强制检查一次状态（带 UI 反馈）
 * - 如果检查后发现登录已过期，弹窗提示并跳转登录页
 * - 如果未登录，直接跳转登录页
 */
async function handleAvatarClick() {
  if (userStore.isSchoolLoggedIn) {
    // ⭐ 强制检查一次状态（带 UI 反馈）
    const result = await checkStatusWithUI({
      showLoading: true,
      showResult: true
    })

    // 如果检查后发现未登录（Cookie 过期），弹窗提示
    if (!result.logined) {
      showExpiredDialog.value = true
    }
  } else {
    // 未登录，直接跳转登录页
    goLogin()
  }
}

/**
 * 处理跳转登录（从过期弹窗）
 */
function handleGoLogin() {
  showExpiredDialog.value = false
  goLogin()
}

// ==================== 登出确认 ====================

function handleLogout() {
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await userStore.logoutSchool()
  uni.showToast({ title: '已退出登录', icon: 'success' })
}

// ==================== 更新会话 ====================

function handleResetSession() {
  showResetConfirm.value = true
}

async function confirmResetSession() {
  showResetConfirm.value = false

  // 显示加载
  uni.showLoading({ title: '正在重置...' })

  try {
    const success = await userStore.resetSession()

    uni.hideLoading()

    if (success) {
      uni.showToast({ title: '会话已更新', icon: 'success' })

      // 重新执行认证检查
      await ensure({ requireSchoolLogin: false, forceCheck: true })
    } else {
      uni.showToast({ title: '重置失败，请重试', icon: 'error' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '重置失败', icon: 'error' })
  }
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