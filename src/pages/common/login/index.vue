<template>
  <view class="login">
    <text class="title">登录 iCampus</text>
    <text class="subtitle">使用深技大账号登录</text>

    <!-- 登录方式切换 -->
    <view class="tabs">
      <text
        :class="['tab', method === 'password' && 'tab-active']"
        @tap="method = 'password'"
      >
        账号密码
      </text>
      <text
        :class="['tab', method === 'sms' && 'tab-active']"
        @tap="method = 'sms'"
      >
        短信验证
      </text>
    </view>

    <!-- 账密登录表单 -->
    <view v-if="method === 'password'" class="form">
      <t-input v-model="form.username" label="学号" placeholder="请输入学号" />
      <t-input v-model="form.password" label="密码" type="password" placeholder="请输入密码" />
    </view>

    <!-- 短信登录表单 -->
    <view v-else class="form">
      <t-input v-model="form.phone" label="手机号" placeholder="请输入手机号" />
      <view class="sms-row">
        <t-input v-model="form.smsCode" label="验证码" placeholder="请输入验证码" />
        <t-button
          size="small"
          theme="primary"
          variant="outline"
          :disabled="countdown > 0"
          @click="handleSendSms"
        >
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </t-button>
      </view>
    </view>

    <!-- 登录按钮 -->
    <t-button
      theme="primary"
      size="large"
      block
      :loading="loading"
      style="margin-top: 60rpx"
      @click="handleLogin"
    >
      登录
    </t-button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/store'
import type { LoginMethod } from '@/api/types/auth'

const userStore = useUserStore()

// 表单数据
const method = ref<LoginMethod>('password')
const loading = ref(false)
const countdown = ref(0)
const form = ref({
  username: '',
  password: '',
  phone: '',
  smsCode: '',
})

// 从路由参数获取登录方式（首页检查后传过来的）
onLoad((options) => {
  if (options?.method) {
    method.value = options.method as LoginMethod
  }
})

// 发验证码
async function handleSendSms() {
  if (!form.value.phone) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }
  try {
    await userStore.sendSms(form.value.phone)
    // 开始倒计时
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch {
    uni.showToast({ title: '发送失败', icon: 'none' })
  }
}

// 登录
async function handleLogin() {
  // 简单校验
  if (method.value === 'password') {
    if (!form.value.username || !form.value.password) {
      uni.showToast({ title: '请填写完整', icon: 'none' })
      return
    }
  } else {
    if (!form.value.phone || !form.value.smsCode) {
      uni.showToast({ title: '请填写完整', icon: 'none' })
      return
    }
  }

  loading.value = true
  try {
    await userStore.login({
      method: method.value,
      username: form.value.username,
      password: form.value.password,
      phone: form.value.phone,
      smsCode: form.value.smsCode,
    })

    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/home/index' })
    }, 1500)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login {
  padding: 80rpx 40rpx;
}
.title {
  font-size: 48rpx;
  font-weight: bold;
  display: block;
  margin-bottom: 16rpx;
}
.subtitle {
  font-size: 28rpx;
  color: #999;
  display: block;
  margin-bottom: 60rpx;
}
.tabs {
  display: flex;
  gap: 30rpx;
  margin-bottom: 40rpx;
}
.tab {
  font-size: 28rpx;
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  color: #999;
}
.tab-active {
  color: #0052d9;
  font-weight: bold;
  background: rgba(0, 82, 217, 0.08);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.sms-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
</style>
