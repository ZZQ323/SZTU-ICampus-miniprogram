<!--
  首页（三层分治 + TDesign 重构版）

  文件：src/pages/home/home.vue

  设计：
  - 顶部：用户卡片（渐变背景 + 头像 + 姓名学号）
  - 中间：功能宫格（公告 / 课表，带 badge）
  - 下方：cell 列表（操作项）
  - 风格：扁平、干净、与 notice 页统一
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import FloatingNotification from '@/components/FloatingNotification.vue'
import { useUserStore } from '@/store/modules/user'
import { useInfoStore } from '@/store/modules/info'
import { useAuthGuard } from '@/hooks/useAuthGuard'

// ==================== Store ====================

const userStore = useUserStore()
const infoStore = useInfoStore()
const { ensure, isReady } = useAuthGuard()

// ==================== 状态 ====================

const refreshing = ref(false)

// ==================== 计算属性 ====================

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)
const userInfo = computed(() => userStore.userInfo)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const displayName = computed(() => {
  if (!isLoggedIn.value) return '同学'
  return userInfo.value?.realName || '同学'
})

const announcementBadge = computed(() => infoStore.getUnreadCount('announcement'))

// ==================== 方法 ====================

function goNotice() {
  uni.switchTab({ url: '/pages/notice/notice' })
}

function goSchedule() {
  uni.switchTab({ url: '/pages/schedule/schedule' })
}

function goSchoolCalendar() {
  uni.navigateTo({ url: '/pages/school-calendar/school-calendar' })
}

function goActivityCalendar() {
  uni.navigateTo({ url: '/pages/calendar/calendar' })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/common/login/login' })
}

async function handleRefreshSession() {
  if (refreshing.value) return
  refreshing.value = true
  uni.showLoading({ title: '刷新中...' })
  try {
    // 一次刷新做两件事：学校 cookie 续期 + 信息流未读计数拉取
    await userStore.refreshSession()
    await infoStore.init().catch(() => { /* info init 失败不影响主流程 */ })
    uni.showToast({ title: '会话已刷新', icon: 'success' })
  } catch (e: any) {
    if (e?.code === 401 || e?.code === 400) {
      userStore.clearSchoolSession()
      uni.showToast({ title: '会话已过期，请重新登录', icon: 'none' })
      setTimeout(() => uni.navigateTo({ url: '/pages/common/login/login' }), 1000)
    } else {
      uni.showToast({ title: e.message || '刷新失败', icon: 'none' })
    }
  } finally {
    uni.hideLoading()
    refreshing.value = false
  }
}

function handleLogout() {
  uni.showModal({
    title: '确认退出',
    content: '退出后需要重新登录学校账号',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '退出中...' })
      try {
        await userStore.logoutSchool()
        uni.showToast({ title: '已退出', icon: 'success' })
      } catch (e) {
        console.error('[Home] 退出失败', e)
      } finally {
        uni.hideLoading()
      }
    }
  })
}

function handleResetSession() {
  uni.showModal({
    title: '重置会话',
    content: '将清空所有登录状态，确定继续？',
    confirmColor: '#fa5151',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '重置中...' })
      try {
        const ok = await userStore.resetSession()
        uni.showToast({
          title: ok ? '已重置' : '重置失败',
          icon: ok ? 'success' : 'error'
        })
      } catch (e) {
        uni.showToast({ title: '重置失败', icon: 'error' })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

// ==================== 生命周期 ====================

onShow(async () => {
  await ensure()
  if (isLoggedIn.value) {
    infoStore.init()
  }
})

watch(isLoggedIn, (val) => {
  if (val) infoStore.init()
})
</script>

<template>
  <PageLayout>
    <view v-if="isReady" class="home">

      <!-- ==================== 顶部卡片 ==================== -->
      <view class="profile-card">
        <view class="profile-row">
          <!-- 头像 -->
          <view class="avatar" @tap="isLoggedIn ? undefined : goLogin()">
            <image v-if="userInfo?.avatarURL" :src="userInfo.avatarURL" class="avatar-img" mode="aspectFill" />
            <t-icon v-else name="user" size="44rpx" color="rgba(255,255,255,0.9)" />
          </view>

          <!-- 文字 -->
          <view class="profile-text">
            <text class="profile-greeting">{{ greeting }}，{{ displayName }}</text>
            <text v-if="isLoggedIn" class="profile-id">{{ userInfo?.userId }} · 深圳技术大学</text>
            <text v-else class="profile-id" @tap="goLogin">点击登录校园账号 →</text>
          </view>

          <!-- 右侧按钮 -->
          <view v-if="isLoggedIn" class="profile-action" @tap="handleLogout">
            <t-icon name="poweroff" size="72rpx" color="rgba(255,255,255,0.8)" />
          </view>
          <view v-else class="profile-action login-action" @tap="goLogin">
            <text>登录</text>
          </view>
        </view>
      </view>

      <!-- ==================== 功能入口 ==================== -->
      <view class="section">
        <view class="grid-2">
          <!-- 信息流 -->
          <view class="grid-card" @tap="goNotice">
            <view class="grid-icon notice-icon">
              <t-icon name="notification" size="44rpx" color="#0052d9" />
              <view v-if="announcementBadge > 0" class="badge">
                {{ announcementBadge > 99 ? '99+' : announcementBadge }}
              </view>
            </view>
            <text class="grid-title">信息流</text>
            <text class="grid-desc">公告 · 教务 · 新闻</text>
          </view>

          <!-- 课表 -->
          <view class="grid-card" @tap="goSchedule">
            <view class="grid-icon schedule-icon">
              <t-icon name="calendar" size="44rpx" color="#07c160" />
            </view>
            <text class="grid-title">课表</text>
            <text class="grid-desc">查看课程安排</text>
          </view>

          <!-- 校历 -->
          <view class="grid-card" @tap="goSchoolCalendar">
            <view class="grid-icon calendar-icon">
              <t-icon name="calendar-2" size="44rpx" color="#ff976a" />
            </view>
            <text class="grid-title">校历</text>
            <text class="grid-desc">学年 · 春秋学期</text>
          </view>

          <!-- 活动日历 -->
          <view class="grid-card" @tap="goActivityCalendar">
            <view class="grid-icon activity-icon">
              <t-icon name="star" size="44rpx" color="#9c27b0" />
            </view>
            <text class="grid-title">活动日历</text>
            <text class="grid-desc">讲座 · 比赛 · 招聘</text>
          </view>
        </view>
      </view>

      <!-- ==================== 操作列表 ==================== -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">快捷操作</text>
        </view>
        <t-cell-group theme="card">
          <t-cell
            v-if="isLoggedIn"
            title="刷新会话"
            left-icon="refresh"
            arrow
            hover
            description="续期学校 Cookie + 拉取最新未读"
            :note="refreshing ? '刷新中...' : ''"
            @click="handleRefreshSession" />
        </t-cell-group>
      </view>

      <!-- ==================== 高级操作（登录后） ==================== -->
      <view v-if="isLoggedIn" class="section">
        <view class="section-header">
          <text class="section-title">高级操作</text>
        </view>
        <t-cell-group theme="card">
          <t-cell title="重置会话" left-icon="delete" arrow hover description="清空服务器和本地的所有登录状态"
            @click="handleResetSession" />
        </t-cell-group>
      </view>

      <!-- 底部留白 -->
      <view style="height: 120rpx;" />

      <!-- 悬浮通知 -->
      <FloatingNotification />
    </view>
  </PageLayout>
</template>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: #f5f5f5;
}

/* ==================== 顶部卡片 ==================== */

.profile-card {
  background: linear-gradient(135deg, #0052d9 0%, #2b7bef 100%);
  padding: 48rpx 32rpx 40rpx;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.profile-text {
  flex: 1;
  min-width: 0;
}

.profile-greeting {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
}

.profile-id {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4rpx;
}

.profile-action {
  flex-shrink: 0;
  padding: 12rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);

  &:active {
    background: rgba(255, 255, 255, 0.2);
  }
}

.login-action {
  border-radius: 32rpx;
  padding: 10rpx 28rpx;
  font-size: 26rpx;
  color: #fff;
}

/* ==================== 功能宫格 ==================== */

.section {
  margin: 24rpx 24rpx 0;
}

.section-header {
  padding: 0 8rpx 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16rpx;
}

.grid-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  transition: background 0.15s;

  &:active {
    background: #f9f9f9;
  }
}

.grid-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 4rpx;
}

.notice-icon {
  background: rgba(0, 82, 217, 0.08);
}

.schedule-icon {
  background: rgba(7, 193, 96, 0.08);
}

.activity-icon {
  background: rgba(156, 39, 176, 0.10);
}

.calendar-icon {
  background: rgba(255, 151, 106, 0.12);
}

.badge {
  position: absolute;
  top: -6rpx;
  right: -10rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: #fff;
  background: #fa5151;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grid-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.grid-desc {
  font-size: 22rpx;
  color: #999;
}
</style>