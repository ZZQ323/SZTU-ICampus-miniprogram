// const { StreamManager } = require('./utils/stream.js')
import { authManager, AuthState, AuthStep } from './api/auth';
// let appId = wx.getAccountInfoSync().miniProgram.appId;
// let showAd = util.showAd();
// if (showAd===undefined || showAd === '') {
//   showAd = 1;
// }

App({
  globalData: {
    authState: AuthState.IDLE,
    authDescription: '',
    cookies: null,
    userInfo: {
      userId: '',        // 内部用户ID
      realName: '',
      gender: '',
      department: '',    // 院系
      nickname: '',      // 昵称，沿用微信昵称
      avatarUrl: '',     // 头像，沿用微信头像
    },
    settings: {
      theme: 'light',
      notifyEnabled: true,
      autoLogin: false
    },
    // 系统信息
    systemInfo: {
      StatusBar: 0,
      CustomBar: 0
    },
    streamManager: null
  },

  async onLaunch() {
    // 检查小程序更新
    this.checkForUpdates();
    // 获取系统信息
    this.getSystemInfo();
    // 执行初始 token 检查
    authManager.init();
    // 监听状态变化（全局）
    authManager.on('stateChange', ({ oldState, newState, description }) => {
      console.log(`认证状态: ${description}`);
      // 可以在这里更新全局状态
      this.globalData.authState = newState;
      this.globalData.authDescription = description;
    });
    // 监听达到最大重试次数
    authManager.on('maxRetryReached', ({ step, retries }) => {
      console.error('认证失败，达到最大重试次数');
      wx.showModal({
        title: '连接失败',
        content: '无法连接到服务器，请检查网络后重试',
        confirmText: '重试',
        cancelText: '退出',
        success: (res) => {
          if (res.confirm) {
            authManager.retry(step);
          } else {
            wx.exitMiniProgram();
          }
        }
      });
    });
    // 开始初始检查
    this.performInitialCheck();
  },


  // 检查小程序更新
  checkForUpdates() {
    if (!wx.canIUse('getUpdateManager')) return;
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate((res) => {
      if (!res.hasUpdate) return;

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) updateManager.applyUpdate();
          }
        });
      });
    });
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const windowInfo = wx.getWindowInfo();
      const deviceInfo = wx.getDeviceInfo();

      this.globalData.systemInfo.StatusBar = windowInfo.statusBarHeight;
      this.globalData.systemInfo.CustomBar = deviceInfo.platform === 'android'
        ? windowInfo.statusBarHeight + 50
        : windowInfo.statusBarHeight + 45;
    } catch (error) {
      console.error('获取系统信息失败:', error);
    }
  },

  async performInitialCheck() {
    const result = await authManager.check(AuthStep.TOKEN);

    if (result.success && authManager.isLoggedIn) {
      // 已登录，跳转首页
      wx.switchTab({ url: '/pages/home/index' });
    } else if (result.success && !authManager.isLoggedIn) {
      // Token 有效但未登录，跳转登录页
      wx.navigateTo({ url: '/pages/login/index' });
    }
    // 失败的情况会自动重试
  },

  async onShow() {
    console.log('App onShow');

    // 如果token状态为有效，跳过验证
    // if (this.globalData.auth.state === 'valid') {
    //   console.log('已登录，跳过验证');
    //   return;
    // }

    // 如果没有正在重试，检查登录状态
    // if (!this.globalData.auth.retryTimer) {
    //   console.log('检查登录状态...');
    //   const tokenValid = await this.validateToken();

    //   if (!tokenValid) {
    //     await this.checkSessionAndNavigate();
    //   }
    // }
  },

  onHide() {
    console.log('App onHide');
    // 应用隐藏时停止重试
    // this.stopRetry();
  },

  onError(error) {
    console.error('App发生错误:', error);
  }
});