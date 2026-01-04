import { rememberChangeHandler, studentIdInputHandler, codeInputHandler, postApp } from '../utils.js';


Component({
  // 父传子：通过 Properties
  // 定义允许接收的属性
  // 父组件更新数据，会自动流向子组件
  properties: {
    // 初始手机号
    initialStuId: {
      type: String,
      value: ''
    }
  },

  data: {
    stuId: '',          // 手机号
    code: '',           // 验证码
    focusField: '',     // 当前聚焦的字段
    countdown: 0,       // 倒计时秒数
    isSending: false,   // 是否正在发送
    isStuIdValid: false, // 手机号是否有效
    errorMsg: '',       // 错误信息
    countdownTimer: null // 倒计时定时器
  },

  lifetimes: {
    attached() {
      // 组件挂载时，如果有初始手机号，则设置
      if (this.properties.initialStuId) {
        this.setData({
          stuId: this.properties.initialStuId
        });
        this.validateStuId(this.properties.initialStuId);
      }
    },

    detached() {
      // 组件销毁时清除定时器
      this.clearCountdown();
    }
  },

  methods: {
    // === 输入处理 ===
    onStuIdInput(e) {
      const value = e.detail.value;
      this.setData({
        stuId: value,
        errorMsg: ''  // 清空错误信息
      });
    },
    onRememberChange(e) { rememberChangeHandler.call(this, e); },
    onStudentIdInput(e) { codeInputHandler.call(this, e); },
    onCodeInput(e) { codeInputHandler.call(this, e); },
    // === 请求验证码 ===
    onSendSmsCode(e) {
      // 检查是否正在发送或倒计时中
      if (this.data.isSending || this.data.countdown > 0) {
        return;
      }
      // 请求按钮

      postApp.call(e.target, e, "/usr/sms",
        function check() {
          const {studentId,password,remember} = this.data;
          if (!studentId) {
            wx.showToast({
              title: '请输入学号',
              icon: 'none'
            });return;
          }
          if (!password) {
            wx.showToast({
              title: '请输入密码',
              icon: 'none'
            });return;
          }
          // 记忆账号
          if (remember) {
            wx.setStorageSync('savedStudentId', studentId);
          } else {
            wx.removeStorageSync('savedStudentId');
          }
        },
          
      )

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
    }
  }
});