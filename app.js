// const { StreamManager } = require('./utils/stream.js')
const { performInitialCheck } = require('./utils/auth');
import api from 'api/api.js'
import util from 'utils/util.js'
let appId = wx.getAccountInfoSync().miniProgram.appId;
// let showAd = util.showAd();
// if (showAd===undefined || showAd === '') {
//   showAd = 1;
// }

App({
  globalData: {
    cookies: null,
    userInfo: {
      userId: '',        // 内部用户ID
      realName: '',
      gender: '',
      department: '',    // 院系
      nickname: '',      // 昵称，沿用微信昵称
      avatarUrl: '',     // 头像，沿用微信头像
    },
    baseURL: 'http://192.168.3.35:8080',
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
    apis: api,
    utils: util,
    appId: appId,
    streamManager: null
  },

  async onLaunch() {
    // 检查小程序更新
    this.checkForUpdates();
    // 获取系统信息
    this.getSystemInfo();
    // 执行初始登录检查
    await performInitialCheck(this);
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