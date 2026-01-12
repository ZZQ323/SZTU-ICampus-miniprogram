// const { smsUrl, loginUrl } = require("../../components/login/utils");
// import { IUserInfo } from '../../types/userInfo';

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
    isLogining: false,
    countdownTimer: null,
    countdown: 0
  },
  onLoad(options) {
    // 如果要登录，也即尝试自动登录失败了
    this.setData({
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
    });
    const usrIds = wx.getStorageSync('usrIds') || [];
    if (usrIds.length > 0) {
      // 本地有历史 usrIds 存在
      this.setData({
        originalUsrIds: usrIds
      });
    }
    const localCookies = wx.getStorageSync('cookies') || [];
    if (localCookies.length > 0) {
      // 本地有历史 cookies 存在，可尝试直接登录，无需密码
      this.setData({
        cookies: localCookies
      });
      wx.request({
        url: getApp().globalData.baseURL + cookieLoginUrl, // 接口地址
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          cookies,
        },
        success: (res) => {
          console.log('登录接口返回：', res.data);
          if (res.statusCode === 200) {
            wx.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 2000
            });
            setTimeout(() => {
              // 延时跳转到首页，首页是tab页
              wx.switchTab({ url: '/pages/home/index' });
            }, 2000);
            // 持久化储存
            if (rememberAcc) {
              newArrays = wx.getStorageSync('usrIds');
              newArrays.push(this.data.userInfo.userId);
              newArrays = setFunction(newArrays);
              wx.setStorageSync('usrIds', {
                acceptedArrays: newArrays
              });
              console.log("已进行本地持久化储存");
            }
            updateDataset(res.data);
          } else {
            wx.showToast({
              title: res.data.msg || '登录失败，请检查账号密码',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          // 请求失败回调（网络错误、接口不可达等）
          console.error('登录请求失败：', err);
          wx.showToast({
            title: '登录时出现错误，请稍后重试',
            icon: 'none',
            duration: 2000
          });
        }
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

  onSendSmsCode(e) {
    // 检查是否正在发送或倒计时中
    if (this.data.isSending || this.data.countdown > 0)
      return;
    if (this.data.userInfo.userId === null || this.data.userInfo.userId.length <= 0) {
      wx.showToast({ title: '请先输入工号', icon: 'none' });
      return;
    }
    // 防连击
    this.setData({ isSending: true });
    this.startCountdown(60);

    // 请求
    wx.request({
      url: getApp().globalData.baseURL + smsUrl, // 接口地址
      method: 'GET',
      header: {},
      data: {
        id: this.data.userInfo.userId,
      },
      success: (res) => {
        console.log('请求验证码接口返回：', res.data);
        if (res.statusCode === 200) {
          wx.showToast({
            title: '验证码已发送',
            icon: 'success',
            duration: 2000
          });
        }
        else {
          // 请求失败回调（网络错误、接口不可达等）
          wx.showToast({
            title: res.data.msg || '请求验证码异常，请检查账号密码',
            icon: 'error',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('验证码请求失败：', err);
        wx.showToast({
          title: '网络异常，请稍后重试',
          icon: 'error',
          duration: 2000
        });
        // 重置发送状态
        this.resetCountdown();
      }
    });

  },

  // === 倒计时处理 ===
  startCountdown(seconds) {
    // 先清除可能存在的定时器
    this.clearCountdown();
    this.setData({ countdown: seconds });
    // 设置定时器
    const timer = setInterval(() => {
      const newCountdown = this.data.countdown - 1;
      if (newCountdown <= 0) {
        this.resetCountdown();
      } else {
        this.setData({ countdown: newCountdown });
      }
    }, 1000);
    this.setData({ countdownTimer: timer });
  },

  // === 重置倒计时 ===
  resetCountdown() {
    this.clearCountdown();
    this.setData({
      countdown: 0,
      isSending: false
    });
  },

  // === 倒计时终止 ===
  clearCountdown() {
    if (this.data.countdownTimer) {
      // 清除定时器
      clearInterval(this.data.countdownTimer);
      this.setData({ countdownTimer: null });
    }
  },

  // === 显示错误 ===
  showError(message) {
    this.setData({ errorMsg: message });
    setTimeout(() => {
      this.setData({ errorMsg: '' });
    }, 3000);
  },

  onTapSubmit(e) {
    if (!this.data.userInfo.userId) {
      wx.showToast({ title: '请输入学号', icon: 'none' });
      return;
    }
    if (!this.data.userInfo.code) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    wx.showLoading({
      title: '登录中...',
      mask: true
    });
    this.setData({
      isLogining: true
    });

    // 发送POST请求
    wx.request({
      url: getApp().globalData.baseURL + loginUrl, // 接口地址
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      data: {

        
        userId: this.data.userInfo.userId,
        code: this.data.userInfo.code,
        loginType: "SMS"
      },
      success: (res) => {
        console.log('登录接口返回：', res.data);
        if (res.statusCode === 200) {
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 2000
          });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/home/index' });
          }, 2000);
          // 持久化储存
          if (rememberAcc) {
            newArrays = wx.getStorageSync('usrIds');
            newArrays.push(this.data.userInfo.userId);
            newArrays = setFunction(newArrays);
            wx.setStorageSync('usrIds', {
              acceptedArrays: newArrays
            });
            console.log("已进行本地持久化储存");
          }
          updateDataset(res.data);
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
      }
    });
    this.setData({ isLogining: false });
  },

  // === 记忆勾与持久化储存 ===
  onRememberChange(e) {
    this.setData({
      rememberAcc: e.detail.value.length > 0
    });
  },

  updateDataset(resData) {
    const app = getApp();
    app.globalData.setData({
      cookies: this.data.cookies,
      userInfo: resData.userInfo,
      loginTimeStamp: Date.now(),
      isLoggedIn: true,
    });
  }
});