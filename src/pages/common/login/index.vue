<script setup lang="ts">
/**
 * 登录页面
 * 
 * 文件：src/pages/login/index.vue
 */

import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { useCountdown } from '@/hooks/useCountdown'
import { navigateBack } from '@/utils/router'
import type { LoginType } from '@/api/types/auth'

const userStore = useUserStore()

// 状态
const loading = ref(false)
const initializing = ref(true)
const loginTypes = ref<LoginType[]>(['SMS'])
const activeTab = ref<LoginType>('SMS')

// 表单
const userId = ref('')
const password = ref('')
const smsCode = ref('')

// 历史学号
const historyIds = ref<string[]>([])
const showHistory = ref(false)

// 倒计时
const { counting, buttonText, start: startCountdown } = useCountdown(60)

// 计算属性
const canLogin = computed(() => {
  if (!userId.value) return false
  if (activeTab.value === 'SMS') return smsCode.value.length >= 4
  if (activeTab.value === 'PASSWORD') return password.value.length >= 6
  return false
})

const showPasswordTab = computed(() => loginTypes.value.includes('PASSWORD'))

// 初始化
onMounted(async () => {
  try {
    // 1. 先检查状态（轻量级，不会清除 Cookie）
    const status = await userStore.checkSchoolSession()
    // 2. 如果已经登录了，直接返回
    if (status.logined) {
      uni.showToast({ title: '已登录', icon: 'success' })
      setTimeout(() => navigateBack(), 500)
      return
    }
    // 3. 未登录，使用返回的 loginTypes
    loginTypes.value = status.loginTypes || ['SMS']
    // 4. 获取历史学号
    historyIds.value = await userStore.fetchHistoryUserIds()
    // 默认填充第一个历史学号
    if (historyIds.value.length > 0) {
      userId.value = historyIds.value[0]
    }
  } catch (e: any) {
    // 5. 如果 getStatus 失败（比如没有 Cookie），才需要 initSession
    console.warn('检查状态失败，尝试初始化', e)
    try {
      const result = await userStore.initSession()
      loginTypes.value = result.loginTypes || ['SMS']
    } catch (initError) {
      console.error('初始化失败', initError)
      uni.showToast({ title: '初始化失败', icon: 'error' })
    }
  } finally {
    initializing.value = false
  }
})

// 发送验证码
async function handleSendSms() {
  if (!userId.value) {
    uni.showToast({ title: '请输入学号', icon: 'none' })
    return
  }
  if (counting.value) return

  try {
    await userStore.requestSms(userId.value)
    startCountdown()
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '发送失败', icon: 'error' })
  }
}

// 登录
async function handleLogin() {
  if (!canLogin.value) return;

  loading.value = true;
  try {
    const success = await userStore.loginSchool({
      loginType: activeTab.value,
      userId: userId.value,
      password: activeTab.value === 'PASSWORD' ? password.value : undefined,
      smsCode: activeTab.value === 'SMS' ? smsCode.value : undefined,
    });
    
    if (success) {
      uni.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => navigateBack(), 500);
    } else {
      uni.showToast({ title: '登录失败', icon: 'error' });
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '登录失败', icon: 'error' });
  } finally {
    loading.value = false;
  }
}

// 选择历史学号
function selectHistoryId(id: string) {
  userId.value = id
  showHistory.value = false
}

// 切换 Tab
function switchTab(tab: LoginType) {
  activeTab.value = tab
  // 清空对应的输入
  if (tab === 'SMS') password.value = ''
  if (tab === 'PASSWORD') smsCode.value = ''
}

const onBlur = () => {
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

</script>

<template>
  <view class="login-page">
    <!-- 加载中 -->
    <view v-if="initializing" class="loading-container">
      <t-loading theme="circular" size="40px" />
      <text class="loading-text">正在初始化...</text>
    </view>

    <!-- 登录表单 -->
    <view v-else class="login-container">
      <view class="header">
        <text class="title">校园服务登录</text>
        <text class="subtitle">使用学校统一身份认证</text>
      </view>

      <!-- Tab 切换 -->
      <view v-if="showPasswordTab" class="tabs">
        <view class="tab" :class="{ active: activeTab === 'SMS' }" @click="switchTab('SMS')">
          短信验证码
        </view>
        <view class="tab" :class="{ active: activeTab === 'PASSWORD' }" @click="switchTab('PASSWORD')">
          密码登录
        </view>
      </view>

      <!-- 学号输入 -->
      <view class="form-item">
        <t-input :value="userId" @change="userId = $event.value" placeholder="请输入学号" clearable
          @focus="showHistory = historyIds.length > 0" @blur="onBlur" />
        <!-- 历史学号下拉 -->
        <view v-if="showHistory" class="history-dropdown">
          <view v-for="id in historyIds" :key="id" class="history-item" @click="selectHistoryId(id)">
            {{ id }}
          </view>
        </view>
      </view>

      <!-- 短信验证码 -->
      <view v-if="activeTab === 'SMS'" class="form-item sms-row">
        <t-input @change="smsCode = $event.value" placeholder="请输入验证码" type="number" :maxlength="6" class="sms-input" />
        <t-button size="large" :disabled="counting || !userId" @click="handleSendSms">
          {{ buttonText }}
        </t-button>
      </view>

      <!-- 密码 -->
      <view v-if="activeTab === 'PASSWORD'" class="form-item">
        <t-input v-model="password" placeholder="请输入密码" type="password" clearable />
      </view>

      <!-- 登录按钮 -->
      <t-button theme="primary" block :loading="loading" :disabled="!canLogin" @click="handleLogin">
        登录
      </t-button>

      <view class="tips">
        <text>使用学校统一身份认证系统登录</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.loading-text {
  margin-top: 20rpx;
  color: #999;
  font-size: 28rpx;
}

.login-container {
  padding: 80rpx 48rpx;
}

.header {
  text-align: center;
  margin-bottom: 80rpx;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: 600;
  color: #333;
}

.subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #999;
}

.tabs {
  display: flex;
  margin-bottom: 48rpx;
  border-bottom: 1rpx solid #eee;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 30rpx;
  color: #666;
  position: relative;

  &.active {
    color: #1976d2;
    font-weight: 500;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 80rpx;
      height: 4rpx;
      background: #1976d2;
      border-radius: 2rpx;
    }
  }
}

.form-item {
  margin-bottom: 32rpx;
  position: relative;
}

.sms-row {
  display: flex;
  gap: 16rpx;
}

.sms-input {
  flex: 1;
}

.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1rpx solid #eee;
  border-radius: 8rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.history-item {
  padding: 24rpx 32rpx;
  font-size: 28rpx;

  &:not(:last-child) {
    border-bottom: 1rpx solid #f5f5f5;
  }

  &:active {
    background: #f5f5f5;
  }
}

.tips {
  margin-top: 48rpx;
  text-align: center;
  font-size: 24rpx;
  color: #999;
}
</style>