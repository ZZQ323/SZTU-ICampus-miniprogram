// const { StreamManager } = require('./utils/stream.js')
const { isTokenActive, isCookieActive, refreshToken } = require('./utils/auth');

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
    // 登录状态管理
    auth: {
      token: '',
      loginTimeStamp: null,
      state: 'pending', // pending | checking | valid | invalid | expired
      isChecking: false,
      retryTimer: null,
      maxRetryCount: 3,
      currentRetryCount: 0,
    },
    baseURL: 'http://localhost:8080',
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
    // 执行初始登录检查
    await this.performInitialCheck();
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

  // 初始检查
  async performInitialCheck() {
    try {
      // 设置检查状态
      this.globalData.auth.state = 'checking';
      const isTokenValid = await this.validateToken();
      if (isTokenValid) {
        await this.checkSessionAndNavigate();
      } else {
        this.startRetry();
      }
    } catch (error) {
      console.error('初始验证失败:', error);
      this.globalData.auth.state = 'invalid';
      this.startRetry();
    }
  },

  // 验证token
  async validateToken() {
    // 防止重复检查
    if (this.globalData.auth.isChecking) {
      console.log('正在验证中，跳过');
      return false;
    }
    this.globalData.auth.isChecking = true;
    this.globalData.auth.state = 'checking';
    try {
      // 1. 检查本地token
      const storedToken = wx.getStorageSync('token');
      let currentToken = storedToken;
      // 2. 如果没有token，尝试刷新
      if (!storedToken || storedToken.trim() === '') {
        console.log('本地存储没有token，正在获取…');
        await refreshToken(this.globalData.baseURL);
        currentToken = wx.getStorageSync('token');
      }
      // 3. 验证token有效性
      if (currentToken) {
        const tokenValid = await isTokenActive(this.globalData.baseURL, currentToken);
        if (!tokenValid) {
          console.log('token无效，尝试刷新...');
          await refreshToken(this.globalData.baseURL);
          currentToken = wx.getStorageSync('token');
          if (!currentToken)throw new Error('刷新token失败');
          // 验证刷新后的token
          const newTokenValid = await isTokenActive(this.globalData.baseURL, currentToken);
          if (!newTokenValid)throw new Error('刷新后的token仍然无效');
        }
        // 4. 更新全局token
        this.globalData.auth.token = currentToken;
        this.globalData.auth.state = 'valid';
        this.globalData.auth.currentRetryCount = 0; // 重置重试计数
        return true;
      }
      throw new Error('无法获取有效token');
    } catch (error) {
      console.error('验证token失败:', error);
      this.globalData.auth.state = 'invalid';
      return false;
    } finally {
      this.globalData.auth.isChecking = false;
    }
  },

  // 检查session并导航
  async checkSessionAndNavigate() {
    try {
      const sessionValid = await isCookieActive(
        this.globalData.baseURL, 
        this.globalData.auth.token
      );
      if (sessionValid) {
        console.log('验证通过，跳转到首页');
        this.globalData.auth.state = 'valid';
        await this.navigateToHome();
        return true;
      } else {
        console.log('session无效，需要重新登录');
        this.globalData.auth.state = 'expired';
        this.navigateToLogin();
        return false;
      }
    } catch (error) {
      console.error('检查session失败:', error);
      this.globalData.auth.state = 'invalid';
      return false;
    }
  },

  // 启动重试机制
  startRetry() {
    console.log('启动重试机制...');
    // 清除之前的定时器
    this.stopRetry();
    this.globalData.auth.currentRetryCount = 0;
    this.globalData.auth.retryTimer = setInterval(async () => {
      this.globalData.auth.currentRetryCount++;
      console.log(`第 ${this.globalData.auth.currentRetryCount} 次重试...`);
      // 超过最大重试次数
      if (this.globalData.auth.currentRetryCount >= this.globalData.auth.maxRetryCount) {
        wx.exitMiniProgram({
          success: (res) => {console.error('达到最大重试次数，小程序初始化失败，已退出');},
          fail: (res) => {console.error('达到最大重试次数，小程序初始化失败，退出出现错误');}
        })
        return;
      }
      try {
        const tokenValid = await this.validateToken();
        if (tokenValid) {
          console.log('重试验证成功');
          this.stopRetry();
          await this.checkSessionAndNavigate();
        }
      } catch (error) {
        console.error('重试过程中出错:', error);
      }
    }, 5000);
     // 每5秒重试一次
  },
  // 停止重试
  stopRetry() {
    if (this.globalData.auth.retryTimer) {
      clearInterval(this.globalData.auth.retryTimer);
      this.globalData.auth.retryTimer = null;
      console.log('已停止重试机制');
    }
  },
  // 导航到首页
  async navigateToHome() {
    return new Promise((resolve) => {
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/index',
          success: () => {
            console.log('跳转到首页成功');
            resolve(true);
          },
          fail: (err) => {
            console.error('跳转到首页失败:', err);
            resolve(false);
          }
        });
      }, 500);
    });
  },
  // 导航到登录页
  navigateToLogin() {
    wx.reLaunch({ url: '/pages/login/index' });
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