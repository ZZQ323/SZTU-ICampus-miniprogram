import { rememberChangeHandler, studentIdInputHandler, codeInputHandler } from '../utils.js';
import { loginUrl,smsUrl } from '../utils.js';


Component({
  // 父传子：通过 Properties
  // 定义允许接收的属性
  // 父组件更新数据，会自动流向子组件
  properties: {
    initialUsrIds: [],
    rememberAcc: false
  },
  data: {
    usrId: '',          // 学号
    code: '',           // 验证码 / 密码
    focusField: '',     // 当前聚焦的字段
    countdown: 0,       // 倒计时秒数
    isSending: false,   // 是否正在发送
    isStuIdValid: false, // 手机号是否有效
    errorMsg: '',       // 错误信息
    countdownTimer: null, // 倒计时定时器
    originOptions: [], // 原始下拉选项
    filterOptions: []
  },

  lifetimes: {
    attached() {
      // 组件挂载时，如果有初始手机号，则提供选项
      if (this.properties.initialUsrIds) {
        this.setData({
          originOptions: this.properties.initialUsrIds
        });
      }
    },
    detached() {
      // 组件销毁时清除定时器
      this.clearCountdown();
    }
  },

  methods: {
    // === 输入处理 ===
    onUsrIdInput(e) {
      const value = e.detail.value;
      if (remember) wx.setStorageSync('usrId', usrId);
      else wx.removeStorageSync('usrId');
      codeInputHandler.call(this, e);
      this.setData({
        stuId: value,
        errorMsg: ''  // 清空错误信息
      });
    },
    onRememberChange(e) { rememberChangeHandler.call(this, e); },
    onCodeInput(e) { codeInputHandler.call(this, e); },
    // === 请求验证码 ===
    onSendSmsCode(e) {
      // 检查是否正在发送或倒计时中
      if (this.data.isSending || this.data.countdown > 0) {
        return;
      }
      // 请求按钮

      "/usr/sms";

      // 开始发送状态
      this.setData({ isSending: true });

      // 子传父：通过自定义事件
      // 参数：(事件名, 传递的数据, 事件选项)
      // 这里触发一个带detail的事件
      this.triggerEvent('sendsms', {
        stuId: this.data.stuId
      }, {
        bubbles: true,      // 事件是否冒泡
        composed: false,     // 事件是否可穿越组件边界
        capturePhase: false  // 是否在捕获阶段触发 
      });

      // 模拟发送过程（实际应该由父组件控制）
      setTimeout(() => {
        this.setData({ isSending: false });

        // 开始倒计时
        this.startCountdown(60);

        // 显示发送成功提示（可选）
        wx.showToast({
          title: '验证码已发送',
          icon: 'success',
          duration: 2000
        });
      }, 1000);
    },

    // === 倒计时处理 ===
    startCountdown(seconds) {
      this.clearCountdown(); // 先清除可能存在的定时器
      this.setData({ countdown: seconds });
      const timer = setInterval(() => {
        let countdown = this.data.countdown - 1;
        if (countdown <= 0) {
          this.clearCountdown();
          countdown = 0;
        }
        this.setData({ countdown });
      }, 1000);
      this.setData({ countdownTimer: timer });
    },

    clearCountdown() {
      if (this.data.countdownTimer) {
        clearInterval(this.data.countdownTimer);
        this.setData({ countdownTimer: null });
      }
    },

    // === 重置倒计时（可由外部调用） ===
    resetCountdown() {
      this.clearCountdown();
      this.setData({
        countdown: 0,
        isSending: false
      });
    },

    // === 获取表单数据（可由外部调用） ===
    getFormData() {
      return {
        stuId: this.data.stuId,
        code: this.data.code,
        isValid: this.validateStuId(this.data.stuId) && /^\d{6}$/.test(this.data.code)
      };
    },

    // === 显示错误（可由外部调用） ===
    showError(message) {
      this.setData({ errorMsg: message });
      setTimeout(() => {
        this.setData({ errorMsg: '' });
      }, 3000);
    },

    onTapSubmit(e) {

      if (!usrId) {
        wx.showToast({title: '请输入学号',icon: 'none'}); 
        return;
      }
      if (!password) {
        wx.showToast({title: '请输入密码',icon: 'none'}); 
        return;
      }

      wx.showLoading({
        title: '登录中...',
        mask: true
      });

      // 发送POST请求
      wx.request({
        url: getApp().globalData.baseURL + loginUrl, // 接口地址
        method: 'POST', 
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          userId: studentId, 
          password: password
        },
        success: (res) => {
          console.log('登录接口返回：', res.data); 
          if (res.statusCode === 200) {
            wx.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 1500
            });
            
            setTimeout(() => {
              // 延时跳转到首页，首页是tab页
              wx.switchTab({url: '/pages/home/index'});
            }, 2000);
          } else {
            wx.showToast({
              title: res.data.msg || '登录失败，请检查账号密码',
              icon: 'none',
              duration: 2000
            });
          }
        },
        // 请求失败回调（网络错误、接口不可达等）
        fail: (err) => {
          console.error('登录请求失败：', err);
          wx.showToast({
            title: '登录时出现错误，请稍后重试',
            icon: 'none',
            duration: 2000
          });
        },
        // 无论成功失败，都隐藏加载提示
        complete: () => {
          wx.hideLoading();
        }
      });
    }
  }
});