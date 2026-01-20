// pages/loading/index.js
import { authManager, AuthState, AuthStep } from '../../api/auth';

// AuthState 到步骤的映射
const STATE_MAP = {
  [AuthState.IDLE]:              { step: 0, status: 'process' },
  [AuthState.TOKEN_CHECKING]:    { step: 0, status: 'process' },
  [AuthState.TOKEN_REFRESHING]:  { step: 0, status: 'process' },
  [AuthState.TOKEN_VALID]:       { step: 1, status: 'process' },
  [AuthState.TOKEN_INVALID]:     { step: 0, status: 'error' },
  [AuthState.SESSION_CHECKING]:  { step: 1, status: 'process' },
  [AuthState.SESSION_REFRESHING]:{ step: 1, status: 'process' },
  [AuthState.SESSION_VALID]:     { step: 2, status: 'finish' },
  [AuthState.SESSION_EXPIRED]:   { step: 2, status: 'finish' }, // 需要登录，但流程完成
  [AuthState.ERROR]:             { step: -1, status: 'error' }, // 保持当前步骤
  [AuthState.RETRYING]:          { step: -1, status: 'error' }, // 保持当前步骤
};

Page({
  data: {
    // Steps 组件数据
    currentStep: 0,
    currentStatus: 'process', // process | finish | error

    // 状态文本
    statusText: '正在初始化...',
    
    // 重试相关
    isRetrying: false,
    retryCount: 0,
    maxRetries: 3,

    // 完成状态
    isComplete: false,
    isLoggedIn: false,
  },

  // 保存上一个有效的步骤（用于 ERROR/RETRYING 状态）
  _lastValidStep: 0,
  // 取消订阅函数列表
  _unsubscribers: [],

  onLoad() {
    this._setupListeners();
    this._startAuth();
  }, 
  onShow(){
    this._setupListeners();
    this._startAuth();
  },
  onUnload() {
    // 取消所有监听
    this._unsubscribers.forEach(fn => fn?.());
    this._unsubscribers = [];
    authManager.stopRetry();
  },

  // =====================================================
  // 初始化
  // =====================================================
  _setupListeners() {
    // 监听状态变化
    this._unsubscribers.push(
      authManager.on('stateChange', ({ newState, description }) => {
        this._handleStateChange(newState, description);
      })
    );

    // 监听重试
    this._unsubscribers.push(
      authManager.on('retry', ({ current, max }) => {
        this.setData({
          isRetrying: true,
          retryCount: current,
          maxRetries: max,
          statusText: `重试中 (${current}/${max})...`,
        });
      })
    );

    // 监听达到最大重试次数
    this._unsubscribers.push(
      authManager.on('maxRetryReached', () => {
        this.setData({
          statusText: '连接失败，请检查网络',
          currentStatus: 'error',
        });
        this._showRetryModal();
      })
    );
  },

  _startAuth() {
    authManager.check(AuthStep.TOKEN);
  },
  // =====================================================
  // 状态处理
  // =====================================================
  _handleStateChange(newState, description) {
    const mapping = STATE_MAP[newState];
    if (!mapping) return;

    const { step, status } = mapping;
    
    // 如果 step 是 -1，保持上一个有效步骤
    const actualStep = step === -1 ? this._lastValidStep : step;
    
    // 更新上一个有效步骤
    if (step >= 0) {
      this._lastValidStep = step;
    }

    const updateData = {
      currentStep: actualStep,
      currentStatus: status,
      statusText: description,
    };

    // 检查是否完成
    if (newState === AuthState.SESSION_VALID) {
      updateData.isComplete = true;
      updateData.isLoggedIn = true;
      updateData.isRetrying = false;
      this.setData(updateData);
      this._navigateToHome();
      return;
    }

    if (newState === AuthState.SESSION_EXPIRED) {
      updateData.isComplete = true;
      updateData.isLoggedIn = false;
      updateData.isRetrying = false;
      this.setData(updateData);
      this._navigateToLogin();
      return;
    }

    // 非错误状态时重置重试标记
    if (status !== 'error') {
      updateData.isRetrying = false;
    }

    this.setData(updateData);
  },

  // =====================================================
  // 导航
  // =====================================================
  _navigateToHome() {
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/home/index' });
    }, 800);
  },

  _navigateToLogin() {
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/login/index' });
    }, 800);
  },

  // =====================================================
  // 重试相关
  // =====================================================
  _showRetryModal() {
    wx.showModal({
      title: '连接失败',
      content: '无法连接到服务器，请检查网络后重试',
      confirmText: '重试',
      cancelText: '退出',
      success: (res) => {
        if (res.confirm) {
          this.onRetryTap();
        } else {
          wx.exitMiniProgram();
        }
      }
    });
  },

  onRetryTap() {
    this.setData({
      isRetrying: false,
      currentStatus: 'process',
      statusText: '正在重试...',
    });
    authManager.retry(AuthStep.TOKEN);
  },
});