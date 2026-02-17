<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUserStore } from '@/store'
import { useCountdown } from '@/hooks/useCountdown'
import type { LoginType } from '@/api/types/auth'
const userStore = useUserStore()

const userId = ref('')
const password = ref('')
const smsCode = ref('')
const loginType = ref<LoginType>('SMS')
const loading = ref(false)

const { count, isCounting, start: startCountdown } = useCountdown(60)

const canSubmit = computed(() => {
  if (!userId.value) return false
  return loginType.value === 'SMS' ? !!smsCode.value : !!password.value
})

const handleSendSms = async () => {
  if (!userId.value || isCounting.value) return
  try {
    // console.log(userId.value);
    // console.log(typeof userId);
    // console.log(typeof userId===typeof ref(''));
    await userStore.sendSms(userId.value)
    startCountdown()
  } catch {
    uni.showToast({ title: '发送失败', icon: 'error' })
  }
}

const handleLogin = async () => {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  try {
    const success = await userStore.loginSchool({
      loginType: loginType.value,
      userId: userId.value,
      password: loginType.value === 'PASSWORD' ? password.value : undefined,
      smsCode: loginType.value === 'SMS' ? smsCode.value : undefined,
    })
    if (success) {
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => uni.switchTab({ url: '/pages/home/index' }), 500)
    }
  } catch {
    uni.showToast({ title: '登录失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <!-- {{ userId }} -->
  <view class="login-page">
    <view class="header">
      <text class="title">SZTU iCampus</text>
      <text class="subtitle">登录校园系统</text>
    </view>
    <t-tabs :default-value="'SMS'" :value="loginType" @change="loginType = $event.value">
      <t-tab-panel value="SMS" label="短信登录" />
      <t-tab-panel value="PASSWORD" label="密码登录" />
    </t-tabs>
    <view class="form">
      <t-input :value="userId" placeholder="请输入学号" clearable @change="userId = $event.value" >
        <template #label>
          <view class="custom-label">学号</view>
        </template>
      </t-input>
      <view v-if="loginType === 'SMS'" class="sms-row">
        <t-input v-model="smsCode" placeholder="verification Code" type="number">
          <template #label>
            <view class="custom-label">验证码</view>
          </template>
        </t-input>
        <t-button size="large" :disabled="userId.length==0 || isCounting" @click="handleSendSms">
          {{ isCounting ? `${count}s` : '获取验证码' }}
        </t-button>
      </view>
      <t-input v-else v-model="password" placeholder="请输入密码" type="password" />
      <t-button theme="primary" block :loading="loading" :disabled="!canSubmit" @click="handleLogin">
        登录
      </t-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page {
  padding: 40rpx 32rpx;
}

.header {
  text-align: center;
  margin-bottom: 60rpx;

  .title {
    font-size: 48rpx;
    font-weight: bold;
    display: block;
  }

  .subtitle {
    font-size: 28rpx;
    color: #666;
    margin-top: 16rpx;
    display: block;
  }
}

.form {
  margin-top: 40rpx;

  :deep(.t-input),
  :deep(.t-button) {
    margin-bottom: 32rpx;
  }
}

.sms-row {
  display: flex;
  gap: 16rpx;

  :deep(.t-input) {
    flex: 1;
    margin-bottom: 0;
  }

  :deep(.t-button) {
    margin-bottom: 0;
    white-space: nowrap;
  }
}
</style>