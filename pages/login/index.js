const { smsUrl } = require("../../components/login/utils");

// 获取全局 app
const app = getApp()

Page({
  data: {
    userInfo: {
      userId: null,
      code: null
    },
    cookies: [],
    originalUsrIds: [],
    filterUsrIds: [],
    rememberAcc: false,
    isInputing: false,
    isSending: false,
    countdown: 0
  },
  onLoad(options) {
    // 如果要登录，也即尝试自动登录失败了
    this.setData({
      userInfo: {
        userId: null,
        code: null
      },
      originalUsrIds: [],
      filterUsrIds: [],
      rememberAcc: false,
      isInputing: false,
      isSending: false,
      countdown: 0
    });
    const usrIds = wx.getStorageSync('usrIds') || [];
    if (usrIds.length > 0) {
      console.log('usrIds存在');
      this.setData({
        originalUsrIds: usrIds
      });
    }
  },
  onUsrIdInput(e) {
    const inputV = e.detail.value?.trim() || '';
    this.setData({
      'userInfo.userId': inputV,
      isInputing: true
    });
    // 
  },
  onUsrIdFocus(e) {
    // 从data中取当前输入的userId  修复作用域问题
    // const query = this.createSelectorQuery();
    // console.log(query.selectAll('.hint'));
    // console.log(query.selectAll('.hint').fields({properties:true}));
    const inputV = e.detail.value?.trim() || '';
    // 展示提示
    if (inputV.length > 0) {
      const filterUsrIds = this.data.originalUsrIds.filter(ele => { return ele.startsWith(inputV); });
      if (filterUsrIds.length > 0) this.setData({ filterUsrIds });
    } else {
      this.setData({ filterUsrIds: this.data.originalUsrIds });
    }
  },
  onUsrIdBlur(e) {
    this.setData({
      isInputing: false
    });
  },
  onCodeInput(e) {
    const inputV = e.detail.value?.trim() || '';
    this.setData({
      'userInfo.code': inputV
    });
  },
  // 记忆勾
  onRememberChange(e) {
    this.setData({
      rememberAcc: e.detail.value.length > 0
    });
  },
  onSendSmsCode(e) {
    // 检查是否正在发送或倒计时中
    if (this.data.isSending || this.data.countdown > 0)
      return;
    if (this.data.userInfo.userId === null || this.data.userInfo.userId.length <= 0) {
      wx.showToast({ title: '请先输入学号', icon: 'none' });
      return;
    }
    // 请求按钮
    console.log(getApp().globalData.baseURL + smsUrl);
    wx.request({
      url: getApp().globalData.baseURL + smsUrl, // 接口地址
      method: 'GET',
      header: {},
      data: {
        id: this.data.userInfo.userId,
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
            wx.switchTab({ url: '/pages/home/index' });
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
    wx.showToast({
      title: '验证码已发送',
      icon: 'success',
      duration: 2000
    });
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
      wx.showToast({ title: '请输入学号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
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
            wx.switchTab({ url: '/pages/home/index' });
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

});