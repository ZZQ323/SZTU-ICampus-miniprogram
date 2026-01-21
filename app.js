// App.js
import HttpClient from './utils/core/HttpClient';
import TokenManager from './utils/managers/TokenManager';
import CONSTANT from "./utils/constant"

App({
  globalData: {
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
  },

  onLaunch() {
    // 检查小程序更新
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
    // 获取系统信息
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

    // 配置HTTP客户端
    HttpClient.getInstance().config({
      baseURL: CONSTANT.baseURL,
      enableLogging: true
    });

    // 设置Token获取函数
    HttpClient.getInstance().setTokenGetter(async () => {
      return await TokenManager.getInstance().ensureToken();
    });
  },

  onShow() {
    console.log('App onShow');
  },

  onHide() {
    console.log('App onHide');
  },

  onError(error) {
    console.error('App发生错误:', error);
  }
});