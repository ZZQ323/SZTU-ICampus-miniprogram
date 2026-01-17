// const { StreamManager } = require('./utils/stream.js')
const { isTokenActive, isCookieActive } = require('./utils/auth');

App({
  globalData: {
    cookies: null,
    userInfo: {
      // userRole: '',      // 用户角色：student/teacher/admin 等
      userId: '',        // 内部用户ID
      realName: '',
      gender: '',
      department: '',    // 院系
      nickname: '',      // 昵称，沿用微信昵称
      avatarUrl: '',     // 头像，沿用微信头像
    },
    // 登录状态
    token: '',
    loginTimeStamp: null,
    baseURL: 'http://localhost:8080',
    // 用户设置
    settings: {
      theme: 'light',
      notifyEnabled: true,
      autoLogin: false
      // 记住密码选项
    },
    streamManager: null
  },
  async onLaunch() {
    // 检查更新
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: function (res) {
                if (res.confirm) {
                  updateManager.applyUpdate();
                }
              }
            });
          });
        }
      });
    }

    // 获取系统信息（这两个API在微信小程序中是同步的，不需要async/await）
    try {
      const windowInfo = wx.getWindowInfo();
      this.globalData.StatusBar = windowInfo.statusBarHeight;

      const deviceInfo = wx.getDeviceInfo();
      this.globalData.CustomBar = deviceInfo.platform === 'android' ?
        this.globalData.StatusBar + 50 : this.globalData.StatusBar + 45;
    } catch (error) {
      console.error('获取系统信息失败:', error);
    }

    // 从本地存储获取token
    this.globalData.token = wx.getStorageSync('token') || '';

    try {
      // 检查token是否有效
      const tokenValid = await isTokenActive(this.globalData.baseURL, this.globalData.token);
      if (!tokenValid) {
        // token无效，重新获取
        console.log('token无效，重新获取...');
        await this.refreshToken();
        // 获取新token后再次检查
        const tokenValidSec = await isTokenActive(this.globalData.baseURL, this.globalData.token);
        if (!tokenValidSec) {
          throw new Error("无法获取token！！！！");
        }
        this.globalData.token = wx.getStorageSync('token') || '';
      }
      // 保证token有效后，检查cookie
      if (this.globalData.token) {
        const sessionValid = await isCookieActive(this.globalData.baseURL, this.globalData.token);
        if (sessionValid) {
          // 如果cookie有效，跳转到首页
          setTimeout(() => {
            wx.switchTab({ url: '/pages/home/index' }); // 注意：如果home是tab页，要用switchTab
          }, 300);
        }
      }
      // 如果cookie无效，跳转到登录页
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/login/index' });
        // 使用reLaunch关闭所有页面
      }, 300);
    } catch (error) {
      console.error('启动时验证失败:', error);
      // 出错也跳转到登录页
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/login/index' });
      }, 300);
    }
  },

  // 新增的刷新token方法
  async refreshToken() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginRes) => {
          wx.request({
            url: this.globalData.baseURL + '/wx-auth/get-token',
            method: 'POST',
            header: {
              'Content-Type': 'application/json',
              'token': this.globalData.token
            },
            data: { wxCode: loginRes.code },
            success: (response) => {
              if (response.data && response.data.data && response.data.data.token) {
                const { token } = response.data.data;
                console.log("获取到新token：" + token);
                wx.setStorageSync('token', token);
                this.globalData.token = token;
                resolve(token);
              } else {
                reject(new Error('获取token失败'));
              }
            },
            fail: (error) => {
              reject(error);
            }
          });
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  },
  onShow() {

  },
  onHide() {

  }
});