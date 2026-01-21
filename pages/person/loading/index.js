// pages/person/loading/index.js
import { TokenManager, TokenState } from '../../../utils/tokenManager';
import { SessionManager, SessionState } from '../../../utils/sessionManager';

/**
 * 加载步骤定义
 */
const LoadingSteps = {
  TOKEN_CHECK: 0,      // 检查Token
  TOKEN_FETCH: 1,      // 获取Token
  SESSION_CHECK: 2,    // 检查Session
  SESSION_REFRESH: 3,  // 刷新Session
  COMPLETE: 4,         // 完成
};

/**
 * 步骤描述
 */
const StepDescriptions = [
  '检查登录凭证',
  '获取登录凭证',
  '检查会话状态',
  '刷新会话',
  '加载完成',
];

Page({
  data: {
    curstep: 0,
    _stateConstant: StepDescriptions,
    errorMessage: '',
    isError: false,
  },

  // 管理器实例
  _tokenManager: null,
  _sessionManager: null,
  _returnUrl: '',
  _unsubscribeToken: null,
  _unsubscribeSession: null,

  onLoad(options) {
    console.log('[Loading] 页面加载，参数:', options);

    // 解析返回URL
    this._returnUrl = options.returnUrl
      ? decodeURIComponent(options.returnUrl)
      : '/pages/index/index';

    // 获取管理器实例
    this._tokenManager = TokenManager.getInstance();
    this._sessionManager = SessionManager.getInstance();

    // 订阅状态变化
    this._subscribeStateChanges();

    // 开始认证流程
    this._startAuthFlow();
  },

  onUnload() {
    // 取消订阅
    if (this._unsubscribeToken) {
      this._unsubscribeToken();
    }
    if (this._unsubscribeSession) {
      this._unsubscribeSession();
    }
  },

  /**
   * 订阅Token和Session管理器的状态变化
   */
  _subscribeStateChanges() {
    // 订阅Token状态
    this._unsubscribeToken = this._tokenManager.subscribe((state, data) => {
      console.log('[Loading] Token状态变化:', state, data);
      this._updateStepFromState();
    });

    // 订阅Session状态
    this._unsubscribeSession = this._sessionManager.subscribe((state, data) => {
      console.log('[Loading] Session状态变化:', state, data);
      this._updateStepFromState();
    });
  },

  /**
   * 根据管理器状态更新显示步骤
   */
  _updateStepFromState() {
    const tokenState = this._tokenManager.getState();
    const sessionState = this._sessionManager.getState();

    let step = LoadingSteps.TOKEN_CHECK;

    // 根据状态确定当前步骤
    switch (tokenState) {
      case TokenState.IDLE:
      case TokenState.CHECKING:
        step = LoadingSteps.TOKEN_CHECK;
        break;
      case TokenState.FETCHING:
        step = LoadingSteps.TOKEN_FETCH;
        break;
      case TokenState.READY:
        // Token已就绪，看Session状态
        switch (sessionState) {
          case SessionState.IDLE:
          case SessionState.WAITING_TOKEN:
          case SessionState.CHECKING:
            step = LoadingSteps.SESSION_CHECK;
            break;
          case SessionState.REFRESHING:
            step = LoadingSteps.SESSION_REFRESH;
            break;
          case SessionState.READY:
            step = LoadingSteps.COMPLETE;
            break;
          case SessionState.FAILED:
            step = LoadingSteps.SESSION_REFRESH;
            break;
        }
        break;
      case TokenState.FAILED:
        step = LoadingSteps.TOKEN_FETCH;
        break;
    }

    this.setData({ curstep: step });
  },

  /**
   * 开始认证流程
   */
  async _startAuthFlow() {
    this.setData({ isError: false, errorMessage: '' });

    try {
      // 第一步：获取Token
      console.log('[Loading] 开始获取Token...');
      await this._tokenManager.startInLoadingPage();
      console.log('[Loading] Token获取成功');

      // 第二步：确保Session有效
      console.log('[Loading] 开始检查/刷新Session...');
      await this._sessionManager.startInLoadingPage();
      console.log('[Loading] Session就绪');

      // 完成，跳转回原页面
      this.setData({ curstep: LoadingSteps.COMPLETE });

      // 短暂延迟后跳转，让用户看到完成状态
      setTimeout(() => {
        this._navigateBack();
      }, 500);

    } catch (error) {
      console.error('[Loading] 认证流程失败:', error);
      this.setData({
        isError: true,
        errorMessage: error.message || '加载失败，请重试'
      });
    }
  },

  /**
   * 跳转回原页面
   */
  _navigateBack() {
    console.log('[Loading] 跳转回:', this._returnUrl);

    // 尝试使用reLaunch，确保能跳转到任何页面
    wx.reLaunch({
      url: this._returnUrl,
      fail: (err) => {
        console.error('[Loading] reLaunch失败:', err);
        // 失败时跳转到首页
        wx.reLaunch({
          url: '/pages/index/index',
          fail: () => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
      }
    });
  },

  /**
   * 重试按钮点击
   */
  onRetry() {
    this.setData({ curstep: 0 });
    this._startAuthFlow();
  },

  /**
   * 步骤点击（可选，用于调试）
   */
  onFirstChange(e) {
    console.log('[Loading] 步骤点击:', e.detail);
  },

  onReady() { },
  onShow() { },
  onHide() { },
  onPullDownRefresh() { },
  onReachBottom() { },
  onShareAppMessage() { }
});