<!--
  首页（完善版）
  
  文件：src/pages/home/home.vue
  
  ⭐ 改动：
  1. 登录后显示 userId + realName
  2. 新增退出登录按钮
  3. 新增刷新会话（refresh cookie）按钮
  4. 新增重置会话（清空远程+本地）按钮
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import FloatingNotification from '@/components/FloatingNotification.vue'
import { useUserStore } from '@/store/modules/user'
import { useInfoStore } from '@/store/modules/info'
import { useWsStore } from '@/store/modules/ws'
import { useAuth } from '@/hooks/useAuth'

// ==================== Store ====================

const userStore = useUserStore()
const infoStore = useInfoStore()
const wsStore = useWsStore()
const { checkStatusWithUI, needsRefresh } = useAuth()

// ==================== 状态 ====================

const loading = ref(false)
const fabRef = ref<InstanceType<typeof FloatingNotification> | null>(null)

// ==================== 计算属性 ====================

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)
const userInfo = computed(() => userStore.userInfo)
const totalUnread = computed(() => infoStore.totalUnread)

// ==================== 功能入口 ====================

const features = [
  {
    id: 'notice',
    icon: 'notification',
    title: '公告',
    desc: '校园公文通知',
    path: '/pages/notice/notice',
    badge: () => infoStore.getUnreadCount('announcement'),
  },
  {
    id: 'schedule',
    icon: 'calendar',
    title: '课表',
    desc: '查看课程安排',
    path: '/pages/schedule/schedule',
    badge: () => 0,
  },
]

// ==================== 方法 ====================

function handleFeatureTap(feature: typeof features[0]) {
  if (feature.path === '/pages/notice/notice') {
    uni.switchTab({ url: feature.path })
  } else {
    uni.navigateTo({ url: feature.path })
  }
}

async function handleRefreshData() {
  if (!isLoggedIn.value) return
  loading.value = true
  try {
    if (needsRefresh()) {
      await checkStatusWithUI()
    }
    await infoStore.init()
    uni.showToast({ title: '已刷新', icon: 'success' })
  } catch (e) {
    console.error('[Home] 刷新失败', e)
  } finally {
    loading.value = false
  }
}

/** ⭐ 刷新会话（远程 refresh cookie） */
async function handleRefreshSession() {
  uni.showLoading({ title: '刷新会话中...' })
  try {
    await userStore.refreshSession()
    uni.showToast({ title: '会话已刷新', icon: 'success' })
  } catch (e: any) {
    console.error('[Home] 刷新会话失败', e)
    uni.showToast({ title: e.message || '刷新失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

/** ⭐ 退出登录 */
async function handleLogout() {
  uni.showModal({
    title: '确认退出',
    content: '退出后需要重新登录学校账号',
    success: async (res) => {
      if (res.confirm) {
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
    }
  })
}

/** ⭐ 重置会话（核弹选项：清空远程 Redis + 本地存储 + 重新获取 Token） */
async function handleResetSession() {
  uni.showModal({
    title: '重置会话',
    content: '将清空服务器和本地的所有会话数据，然后重新初始化。确定要继续吗？',
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '重置中...' })
        try {
          const success = await userStore.resetSession()
          if (success) {
            uni.showToast({ title: '已重置，请重新登录', icon: 'none' })
          } else {
            uni.showToast({ title: '重置失败', icon: 'error' })
          }
        } catch (e) {
          console.error('[Home] 重置失败', e)
          uni.showToast({ title: '重置失败', icon: 'error' })
        } finally {
          uni.hideLoading()
        }
      }
    }
  })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/common/login/login' })
}

function goSetting() {
  uni.navigateTo({ url: '/pages/common/setting' })
}

// ==================== 生命周期 ====================

onShow(async () => {
  if (isLoggedIn.value && needsRefresh()) {
    await checkStatusWithUI()
  }
  if (isLoggedIn.value) {
    infoStore.init()
  }
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    infoStore.init()
  }
})
</script>

<template>
  <PageLayout>
    <view class="home-page">
      <!-- 用户信息卡片 -->
      <view class="user-card">
        <view class="user-avatar">
          <t-icon v-if="!userInfo?.avatarURL" name="user" size="48rpx" color="#fff" />
          <image v-else :src="userInfo.avatarURL" class="avatar-img" mode="aspectFill" />
        </view>
        <view class="user-info">
          <!-- ⭐ 修复：显示 realName 和 userId -->
          <text class="user-name">{{ isLoggedIn ? (userInfo?.realName || '已登录') : '未登录' }}</text>
          <text class="user-school">{{ isLoggedIn ? (userInfo?.userId || '深圳技术大学') : '点击登录校园账号' }}</text>
        </view>
        <!-- 未登录：登录按钮 -->
        <view v-if="!isLoggedIn" class="login-btn" @tap="goLogin">
          <text>登录</text>
        </view>
        <!-- ⭐ 已登录：退出按钮 -->
        <view v-else class="logout-btn" @tap="handleLogout">
          <text>退出</text>
        </view>
      </view>

      <!-- 功能入口 -->
      <view class="features-grid">
        <view v-for="item in features" :key="item.id" class="feature-item" @tap="handleFeatureTap(item)">
          <view class="feature-icon-wrap">
            <t-icon :name="item.icon" size="48rpx" color="#0052d9" />
            <view v-if="item.badge() > 0" class="feature-badge">
              {{ item.badge() > 99 ? '99+' : item.badge() }}
            </view>
          </view>
          <text class="feature-title">{{ item.title }}</text>
          <text class="feature-desc">{{ item.desc }}</text>
        </view>
      </view>

      <!-- ⭐ 快捷操作（增强版） -->
      <view class="quick-actions">
        <view class="section-title">快捷操作</view>
        <view class="action-list">
          <view class="action-item" @tap="handleRefreshData">
            <t-icon name="refresh" size="36rpx" />
            <text>刷新数据</text>
          </view>
          <view v-if="isLoggedIn" class="action-item" @tap="handleRefreshSession">
            <t-icon name="secured" size="36rpx" />
            <text>刷新会话</text>
          </view>
          <view class="action-item" @tap="goSetting">
            <t-icon name="setting" size="36rpx" />
            <text>设置</text>
          </view>
        </view>
      </view>

      <!-- ⭐ 调试/高级操作（仅登录后显示） -->
      <view v-if="isLoggedIn" class="quick-actions">
        <view class="section-title">高级操作</view>
        <view class="action-list">
          <view class="action-item danger" @tap="handleResetSession">
            <t-icon name="delete" size="36rpx" />
            <text>重置会话</text>
          </view>
        </view>
        <view class="action-hint">重置会话将清空服务器和本地的所有登录状态</view>
      </view>

      <!-- 悬浮通知按钮 -->
      <FloatingNotification ref="fabRef" />
    </view>
  </PageLayout>
</template>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.user-card {
  display: flex;
  align-items: center;
  padding: 40rpx 32rpx;
  background: linear-gradient(135deg, #0052d9, #0066ff);
  gap: 24rpx;
}

.user-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
  display: block;
}

.user-school {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
  display: block;
}

.login-btn,
.logout-btn {
  padding: 12rpx 32rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 32rpx;
  color: #fff;
  font-size: 26rpx;
}

.logout-btn {
  background: rgba(255, 100, 100, 0.3);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  padding: 24rpx;
}

.feature-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  &:active {
    background: #f9f9f9;
  }
}

.feature-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  margin: 0 auto 16rpx;
  background: rgba(0, 82, 217, 0.08);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.feature-badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: #fff;
  background-color: #f54a45;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.feature-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}

.quick-actions {
  margin: 24rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 20rpx;
}

.action-list {
  display: flex;
  gap: 20rpx;
  flex-wrap: wrap;
}

.action-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  color: #666;
  font-size: 24rpx;

  &:active {
    background: #eee;
  }

  &.danger {
    color: #fa5151;
    background: #fff0f0;

    &:active {
      background: #ffe0e0;
    }
  }
}

.action-hint {
  font-size: 22rpx;
  color: #999;
  margin-top: 12rpx;
}
</style>