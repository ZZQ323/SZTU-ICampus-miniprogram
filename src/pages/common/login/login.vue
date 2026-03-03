<!--
  登录页面（重构版）
  
  文件：src/pages/common/login/login.vue
  
  改进点：
  1. 使用 useAuthGuard 处理认证逻辑
  2. 简化状态管理，减少页面内状态
  3. 错误处理统一由全局组件处理
-->

<template>
  <view class="login-page">
    <!-- 登录表单 -->
    <view class="login-container">
      <!-- 头部 -->
      <view class="header">
        <image class="logo" src="/static/logo.png" mode="aspectFit" />
        <text class="title">校园服务登录</text>
        <text class="subtitle">使用学校统一身份认证</text>
      </view>

      <!-- Tab 切换（如果支持多种登录方式） -->
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
        <t-input :value="userId" placeholder="请输入学号" clearable @change="onUserIdChange" @clear="onUserIdClear"
          @focus="onUserIdFocus" @blur="onInputBlur">
          <template #prefix-icon>
            <t-icon name="user" />
          </template>
        </t-input>

        <!-- 历史学号下拉 -->
        <view v-if="showHistory" class="history-dropdown">
          <view v-for="id in historyIds" :key="id" class="history-item" @click="selectHistoryId(id)">
            <t-icon name="time" size="32rpx" color="#999" />
            <text>{{ id }}</text>
          </view>
        </view>
      </view>

      <!-- 短信验证码输入 -->
      <view v-if="activeTab === 'SMS'" class="form-item sms-row">
        <t-input :value="smsCode" placeholder="请输入验证码" type="number" :maxlength="6" class="sms-input"
          @change="onSmsCodeChange">
          <template #prefix-icon>
            <t-icon name="secured" />
          </template>
        </t-input>
        <t-button theme="light" size="large" :disabled="counting || !userId" :loading="sendingSms"
          @click="handleSendSms">
          {{ buttonText }}
        </t-button>
      </view>

      <!-- 密码输入 -->
      <view v-if="activeTab === 'PASSWORD'" class="form-item">
        <t-input :value="password" placeholder="请输入密码" type="password" clearable @change="onPasswordChange"
          @clear="onPasswordClear">
          <template #prefix-icon>
            <t-icon name="lock-on" />
          </template>
        </t-input>
      </view>

      <!-- 登录按钮 -->
      <t-button theme="primary" size="large" block :loading="logging" :disabled="!canLogin" @click="handleLogin">
        登录
      </t-button>

      <!-- 提示 -->
      <view class="tips">
        <t-icon name="info-circle" size="28rpx" color="#999" />
        <text>使用学校统一身份认证系统登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 登录页面
 * 
 * ⭐ 注意：TDesign 小程序组件的 v-model 在某些环境下不工作
 *    这里统一使用 :value + @change 的方式
 */
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { useAuthStore } from '@/store/modules/auth'
import { useCountdown } from '@/hooks/useCountdown'
import { extractString } from '@/utils/tdesign'
import type { LoginType } from '@/types/auth'

const userStore = useUserStore()
const authStore = useAuthStore()

// ==================== 状态 ====================

// 登录方式
const loginTypes = ref<LoginType[]>(['SMS'])
const activeTab = ref<LoginType>('SMS')

// 表单数据
const userId = ref('')
const password = ref('')
const smsCode = ref('')

// 历史学号
const historyIds = ref<string[]>([])
const showHistory = ref(false)

// 加载状态
const logging = ref(false)
const sendingSms = ref(false)

// 倒计时
const { counting, buttonText, start: startCountdown } = useCountdown(60)

// ==================== 计算属性 ====================

// 是否可以登录
const canLogin = computed(() => {
  if (!userId.value) return false
  if (activeTab.value === 'SMS') return smsCode.value.length >= 4
  if (activeTab.value === 'PASSWORD') return password.value.length >= 6
  return false
})

// 是否显示密码登录 Tab
const showPasswordTab = computed(() => loginTypes.value.includes('PASSWORD'))

// ==================== 输入框事件处理 ====================

/** 学号输入变化 */
function onUserIdChange(e: any) {
  userId.value = extractString(e)
}

/** 学号清空 */
function onUserIdClear() {
  userId.value = ''
}

/** 学号输入框聚焦 */
function onUserIdFocus() {
  showHistory.value = historyIds.value.length > 0
}

/** 验证码输入变化 */
function onSmsCodeChange(e: any) {
  smsCode.value = extractString(e)
}

/** 密码输入变化 */
function onPasswordChange(e: any) {
  password.value = extractString(e)
}

/** 密码清空 */
function onPasswordClear() {
  password.value = ''
}

/** 输入框失焦 */
function onInputBlur() {
  // 延迟关闭，确保点击事件能触发
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

// ==================== 生命周期 ====================

onMounted(async () => {
  await initPage()
})

// ==================== 方法 ====================

/**
 * 初始化页面
 */
async function initPage() {
  try {
    // 1. 检查当前状态
    const status = await userStore.checkSchoolSession()

    // 2. 如果已登录，直接返回
    if (status.logined) {
      uni.showToast({ title: '已登录', icon: 'success' })
      setTimeout(() => navigateBack(), 500)
      return
    }

    // 3. 更新登录方式
    loginTypes.value = status.loginTypes || ['SMS']

    // 4. 获取历史学号
    historyIds.value = await userStore.fetchHistoryUserIds()

    // 5. 默认填充第一个历史学号
    if (historyIds.value.length > 0) {
      userId.value = historyIds.value[0]
    }

  } catch (e: any) {
    console.warn('[Login] 检查状态失败，尝试初始化', e)

    // 检查失败，尝试初始化会话
    try {
      const result = await userStore.initSession()
      loginTypes.value = result.loginTypes || ['SMS']
    } catch (initError: any) {
      // 初始化也失败，设置错误状态
      authStore.setError(
        'SERVER_ERROR',
        initError?.message || '初始化失败，请稍后重试',
        true,
        initError
      )
    }
  }
}

/**
 * 切换登录方式
 */
function switchTab(tab: LoginType) {
  activeTab.value = tab
  // 切换时清空对应的输入
  if (tab === 'SMS') password.value = ''
  if (tab === 'PASSWORD') smsCode.value = ''
}

/**
 * 发送验证码
 */
async function handleSendSms() {
  if (!userId.value) {
    uni.showToast({ title: '请输入学号', icon: 'none' })
    return
  }
  if (counting.value || sendingSms.value) return

  sendingSms.value = true
  try {
    await userStore.requestSms(userId.value)
    startCountdown()
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '发送失败', icon: 'error' })
  } finally {
    sendingSms.value = false
  }
}

/**
 * 登录
 */
async function handleLogin() {
  if (!canLogin.value || logging.value) return

  logging.value = true
  try {
    const success = await userStore.loginSchool({
      loginType: activeTab.value,
      userId: userId.value,
      password: activeTab.value === 'PASSWORD' ? password.value : undefined,
      smsCode: activeTab.value === 'SMS' ? smsCode.value : undefined,
    })

    if (success) {
      uni.showToast({ title: '登录成功', icon: 'success' })
      // 设置认证状态为就绪
      authStore.setPhase('ready')
      setTimeout(() => navigateBack(), 500)
    } else {
      uni.showToast({ title: '登录失败', icon: 'error' })
    }
  } catch (e: any) {
    // 错误信息直接显示，不通过全局弹窗
    uni.showToast({
      title: e?.message || '登录失败',
      icon: 'error',
      duration: 2000
    })
  } finally {
    logging.value = false
  }
}

/**
 * 选择历史学号
 */
function selectHistoryId(id: string) {
  userId.value = id
  showHistory.value = false
}

/**
 * 返回上一页
 */
function navigateBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/home/home' })
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f7fa 0%, #ffffff 100%);
}

.login-container {
  padding: 80rpx 48rpx;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 32rpx;
}

.title {
  font-size: 48rpx;
  font-weight: 600;
  color: #333;
}

.subtitle {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #999;
}

.tabs {
  display: flex;
  margin-bottom: 48rpx;
  border-bottom: 2rpx solid #eee;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 30rpx;
  color: #666;
  position: relative;
  transition: color 0.3s;

  &.active {
    color: #1976d2;
    font-weight: 500;

    &::after {
      content: '';
      position: absolute;
      bottom: -2rpx;
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
  top: calc(100% + 8rpx);
  left: 0;
  right: 0;
  background: #fff;
  border: 2rpx solid #eee;
  border-radius: 12rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 400rpx;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 32rpx;
  font-size: 28rpx;
  color: #333;

  &:not(:last-child) {
    border-bottom: 2rpx solid #f5f5f5;
  }

  &:active {
    background: #f5f5f5;
  }
}

.tips {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 48rpx;
  font-size: 24rpx;
  color: #999;
}

:deep(.t-input) {
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 24rpx 32rpx;
}

:deep(.t-button--primary) {
  margin-top: 16rpx;
}
</style>