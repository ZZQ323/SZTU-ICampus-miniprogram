<!--
  登录页面（改进版 - 等待认证信息到达后才显示）
  
  文件：src/pages/common/login/login.vue
  
  改动点：
  1. 使用 isReady 控制内容显示
  2. 从 URL 参数或 userStore 获取 loginTypes
  3. 根据 loginTypes 显示对应的登录方式 Tab
  4. 如果没有 loginTypes，先调用 initSession 获取
-->

<template>
  <PageLayout :enable-fab="false">
    <!-- 只有认证信息就绪后才显示登录表单 -->
    <view v-if="isReady" class="login-page">
      <!-- 顶部 Logo -->
      <view class="logo-section">
        <image class="logo" src="/static/logo.png" mode="aspectFit" />
        <text class="title">SZTU iCampus</text>
        <text class="subtitle">深圳技术大学校园服务</text>
      </view>

      <!-- 登录方式 Tab（根据 loginTypes 动态显示） -->
      <view class="login-tabs">
        <view v-if="supportsSms" :class="['tab-item', { active: activeTab === 'sms' }]" @click="activeTab = 'sms'">
          <t-icon name="chat" size="40rpx" />
          <text>短信验证码</text>
        </view>
        <view v-if="supportsPassword" :class="['tab-item', { active: activeTab === 'password' }]"
          @click="activeTab = 'password'">
          <t-icon name="lock-on" size="40rpx" />
          <text>密码登录</text>
        </view>
      </view>

      <!-- 登录表单 -->
      <view class="login-form">
        <!-- 学号输入 -->
        <view class="form-item">
          <t-input :value="userId" placeholder="请输入学号/工号" clearable @change="onUserIdChange">
            <template #prefix-icon>
              <t-icon name="user" size="44rpx" />
            </template>
          </t-input>
        </view>

        <!-- 短信验证码模式 -->
        <template v-if="activeTab === 'sms'">
          <view class="form-item sms-row">
            <t-input :value="smsCode" placeholder="请输入验证码" type="number" maxlength="6" @change="onSmsCodeChange">
              <template #prefix-icon>
                <t-icon name="secured" size="44rpx" />
              </template>
            </t-input>
            <t-button class="sms-btn" :disabled="!canSendSms || smsCooldown > 0" :loading="sendingSms"
              @click="handleSendSms">
              {{ smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码' }}
            </t-button>
          </view>
        </template>

        <!-- 密码模式 -->
        <template v-if="activeTab === 'password'">
          <view class="form-item">
            <t-input :value="password" placeholder="请输入密码" :type="showPassword ? 'text' : 'password'" clearable
              @change="onPasswordChange">
              <template #prefix-icon>
                <t-icon name="lock-on" size="44rpx" />
              </template>
              <template #suffix-icon>
                <t-icon :name="showPassword ? 'browse' : 'browse-off'" size="44rpx"
                  @click="showPassword = !showPassword" />
              </template>
            </t-input>
          </view>
        </template>

        <!-- 登录按钮 -->
        <t-button class="login-btn" theme="primary" size="large" block :disabled="!canLogin" :loading="logging"
          @click="handleLogin">
          登录
        </t-button>

        <!-- 提示信息 -->
        <view class="tips">
          <text v-if="activeTab === 'sms'">验证码将发送到您绑定的手机号</text>
          <text v-else>请使用统一身份认证密码登录</text>
        </view>

        <!-- 清除缓存（手动兜底） -->
        <view class="clear-cache" @tap="handleClearCache">
          <text>遇到问题？清除缓存重试</text>
        </view>
      </view>
    </view>
  </PageLayout>
</template>

<script setup lang="ts">
/**
 * 登录页面（改进版 - Cookie 保鲜）
 *
 * 核心原则：loginTypes 获取 和 cookies 准备 是两件事。
 * - loginTypes 可以从 URL / userStore 缓存快速获取（控制 UI 显示）
 * - cookies 必须保证新鲜（控制登录能力）
 *   有 cookie → refreshSession（刷新）
 *   没 cookie → initSession（初始化）
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import { useUserStore } from '@/store/modules/user'
import { useAuthStore } from '@/store/modules/auth'
import { useInfoStore } from '@/store/modules/info'
import { hasAuth } from '@/utils/cookie-manager'
import { type LoginType } from '@/types/auth'
import { academicApi } from '@/api/auth-apis'

// ==================== Store ====================

const userStore = useUserStore()
const authStore = useAuthStore()

// ==================== 状态 ====================

/** 是否就绪（loginTypes 已获取） */
const isReady = ref(false)

/** 支持的登录方式 */
const loginTypes = ref<string[]>([])

/** 当前激活的 Tab */
const activeTab = ref<'sms' | 'password'>('sms')

/** 表单数据 */
const userId = ref('')
const smsCode = ref('')
const password = ref('')
const showPassword = ref(false)

/** 状态标记 */
const sendingSms = ref(false)
const smsCooldown = ref(0)
const logging = ref(false)

// ==================== 计算属性 ====================

/** 是否支持短信登录 */
const supportsSms = computed(() => {
  return loginTypes.value.includes('SMS') || loginTypes.value.length === 0
})

/** 是否支持密码登录 */
const supportsPassword = computed(() => {
  return loginTypes.value.includes('PASSWORD')
})

/** 是否可以发送验证码 */
const canSendSms = computed(() => {
  return userId.value.trim().length > 0
})

/** 是否可以登录 */
const canLogin = computed(() => {
  if (!userId.value.trim()) return false

  if (activeTab.value === 'sms') {
    return smsCode.value.trim().length >= 4
  } else {
    return password.value.length > 0
  }
})

// ==================== 生命周期 ====================

onLoad(async (options) => {
  // 显示遮罩
  authStore.setShowMask(true)
  authStore.setCheckingMessage('正在初始化...')

  try {
    // ==================== 第一步：快速获取 loginTypes（控制 UI） ====================
    // loginTypes 可以从缓存获取，让 UI 尽快展示

    if (options?.loginTypes) {
      loginTypes.value = options.loginTypes.split(',')
      console.log('[Login] 从 URL 获取 loginTypes:', loginTypes.value)
    }

    if (loginTypes.value.length === 0 && userStore.loginTypes?.length > 0) {
      loginTypes.value = userStore.loginTypes
      console.log('[Login] 从 userStore 获取 loginTypes:', loginTypes.value)
    }

    // ==================== 第二步：确保 cookies 新鲜（控制登录能力） ====================
    // 无论 loginTypes 是否已获取，cookies 必须是新鲜的
    // 原则：有 cookie → refreshSession，没 cookie → initSession

    if (hasAuth()) {
      // 有 cookie → 刷新会话，顺便拿到 loginTypes
      console.log('[Login] 有本地 cookies，尝试 refreshSession...')
      authStore.setCheckingMessage('正在刷新会话...')

      try {
        const result = await userStore.refreshSession()

        // refreshSession 成功 → cookies 已刷新
        if (result.loginTypes?.length) {
          loginTypes.value = result.loginTypes
        }

        // 如果 refresh 发现已登录 → 无需停留在登录页
        if (result.logined) {
          console.log('[Login] refreshSession 发现已登录，返回上一页')
          uni.navigateBack()
          return
        }
      } catch (e: any) {
        // refreshSession 失败（会话真的过期了）→ fallback 到 initSession
        console.warn('[Login] refreshSession 失败，fallback 到 initSession:', e?.message)
        authStore.setCheckingMessage('正在获取登录信息...')

        const result = await userStore.initSession()
        if (result.loginTypes?.length) {
          loginTypes.value = result.loginTypes
        }
      }
    } else {
      // 没 cookie → 初始化会话
      console.log('[Login] 无本地 cookies，调用 initSession...')
      authStore.setCheckingMessage('正在获取登录信息...')

      const result = await userStore.initSession()
      if (result.loginTypes?.length) {
        loginTypes.value = result.loginTypes
      }
    }

    // ==================== 第三步：设置 UI ====================

    // 兜底：如果还是没拿到 loginTypes，默认 SMS
    if (loginTypes.value.length === 0) {
      loginTypes.value = ['SMS']
    }

    // 设置默认 Tab
    if (supportsPassword.value && !supportsSms.value) {
      activeTab.value = 'password'
    } else {
      activeTab.value = 'sms'
    }

    // 尝试获取上次使用的学号
    const lastUserId = userStore.lastUsedUserId
    if (lastUserId) {
      userId.value = lastUserId
    }

    // 就绪
    isReady.value = true

  } catch (e) {
    console.error('[Login] 初始化失败', e)
    // 默认显示 SMS 登录
    loginTypes.value = ['SMS']
    activeTab.value = 'sms'
    isReady.value = true
  } finally {
    authStore.setShowMask(false)
  }
})

// ==================== 事件处理 ====================

function onUserIdChange(e: { value: string }) {
  userId.value = e.value
}

function onSmsCodeChange(e: { value: string }) {
  smsCode.value = e.value
}

function onPasswordChange(e: { value: string }) {
  password.value = e.value
}

/** 发送验证码 */
async function handleSendSms() {
  if (!canSendSms.value || smsCooldown.value > 0) return

  sendingSms.value = true

  try {
    await userStore.requestSms(userId.value.trim())

    uni.showToast({ title: '验证码已发送', icon: 'success' })

    // 开始倒计时
    smsCooldown.value = 60
    const timer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)

  } catch (e: any) {
    uni.showToast({
      title: e?.message || '发送失败',
      icon: 'error'
    })
  } finally {
    sendingSms.value = false
  }
}

/** 登录 */
async function handleLogin() {
  if (!canLogin.value) return

  logging.value = true
  authStore.setShowMask(true)
  authStore.setCheckingMessage('正在登录...')

  try {
    const loginData = {
      userId: userId.value.trim(),
      loginType: activeTab.value === 'sms' ? 'SMS' : 'PASSWORD' as LoginType,
      smsCode: activeTab.value === 'sms' ? smsCode.value.trim() : undefined,
      password: activeTab.value === 'password' ? password.value : undefined
    }

    const success = await userStore.loginSchool(loginData)

    if (success) {
      uni.showToast({ title: '登录成功', icon: 'success' })

      // 保存学号供下次使用
      userStore.setLastUsedUserId(userId.value.trim())
      // 登录成功后，重置失败标记
      const infoStore = useInfoStore()
      infoStore.resetInitState()

      // 登录成功 → 后台触发教务系统初始化（拿 jwxt 子域 cookies）
      // 不 await：不阻塞跳转，用户无感；失败不影响其他功能
      // 成功后后端会自动爬 acdm-* 源，之后用户可在"教务内网"频道看到数据
      academicApi.initAcademic().catch(() => {
        uni.showModal({
          title: '教务系统初始化失败',
          content: '课表、已收公告、消息通知暂不可用。\n请在「首页」点击"刷新会话"重试。',
          showCancel: false,
          confirmText: '知道了'
        })
      })

      // 延迟返回
      setTimeout(() => {
        uni.navigateBack()
      }, 500)
    } else {
      throw new Error('登录失败')
    }

  } catch (e: any) {
    const msg = e?.message || '登录失败'
    const isSessionExpired = msg.includes('会话已失效') || msg.includes('会话无效') || e?.code === 401

    if (isSessionExpired) {
      // 会话过期 → reLaunch 回首页，首页 ensure() 会刷新状态
      uni.showToast({ title: '会话过期，正在刷新...', icon: 'none' })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/home/home' })
      }, 800)
    } else {
      uni.showToast({ title: msg, icon: 'error' })
    }
  } finally {
    logging.value = false
    authStore.setShowMask(false)
  }
}

/** 清除缓存（手动兜底） */
async function handleClearCache() {
  uni.showLoading({ title: '清除中...' })
  try {
    await userStore.resetSession()
    loginTypes.value = userStore.loginTypes?.length ? userStore.loginTypes : ['SMS']
    uni.showToast({ title: '已清除，请重新登录', icon: 'success' })
  } catch {
    userStore.clearSchoolSession()
    loginTypes.value = ['SMS']
    uni.showToast({ title: '已清除', icon: 'success' })
  } finally {
    uni.hideLoading()
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #e3f2fd 0%, #ffffff 100%);
  padding: 60rpx 40rpx;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
}

.title {
  font-size: 44rpx;
  font-weight: bold;
  color: #1976d2;
  margin-bottom: 8rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #666;
}

.login-tabs {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx 0;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #666;
  transition: all 0.2s;

  &.active {
    background: #1976d2;
    color: #fff;
  }
}

.login-form {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.form-item {
  margin-bottom: 32rpx;

  &.sms-row {
    display: flex;
    gap: 20rpx;

    :deep(.t-input) {
      flex: 1;
    }
  }
}

.sms-btn {
  flex-shrink: 0;
  width: 200rpx;
  font-size: 26rpx;
}

.login-btn {
  margin-top: 48rpx;
  height: 96rpx;
  font-size: 32rpx;
  border-radius: 48rpx;
}

.tips {
  margin-top: 32rpx;
  text-align: center;
  font-size: 24rpx;
  color: #999;
}

.clear-cache {
  text-align: center;
  margin-top: 40rpx;
  padding: 20rpx;
  font-size: 24rpx;
  color: #999;
}
</style>