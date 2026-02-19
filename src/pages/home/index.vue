<!-- home.vue（修复版 - 点击头像时先检查状态同步用户信息） -->
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
        <!-- 未登录/检查中状态 -->
        <template v-else>
          <text class="name">{{ checking ? '检查中...' : '未登录' }}</text>
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
  </view>
</template>

<script setup lang="ts">
/**
 * 首页（修复版）
 * 
 * 修复：点击头像时，先调用 checkSchoolSession 检查真实登录状态
 * 如果已登录，会自动同步用户信息到本地
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()
const checking = ref(false)

// 页面显示时，如果本地无用户信息但有 token，尝试检查登录状态
onShow(async () => {
  if (userStore.hasToken && !userStore.userInfo) {
    checking.value = true
    try {
      await userStore.checkSchoolSession()
    } catch (e) {
      console.warn('自动检查登录状态失败', e)
    } finally {
      checking.value = false
    }
  }
})

// 点击头像：先检查登录状态，再决定跳转
async function handleAvatarClick() {
  checking.value = true

  try {
    // 【修复】无论本地是否有 userInfo，都先检查后端状态
    // checkSchoolSession 会自动同步用户信息到本地
    const status = await userStore.checkSchoolSession()

    if (!status.logined) {
      // 后端确认未登录，跳转登录页
      uni.navigateTo({ url: '/pages/common/login/index' })
    } else {
      // 已登录，此时 userInfo 应该已经同步了
      uni.showToast({ title: '已登录', icon: 'success' })
    }
  } catch (e) {
    console.error('检查登录状态失败', e)
    // 出错时，如果本地有信息就当作已登录，否则跳转登录页
    if (!userStore.isSchoolLoggedIn) {
      uni.navigateTo({ url: '/pages/common/login/index' })
    } else {
      uni.showToast({ title: '检查失败', icon: 'none' })
    }
  } finally {
    checking.value = false
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
</style>