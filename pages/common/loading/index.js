// pages/common/loading/index.js

import TokenManager from '../../../utils/managers/TokenManager';
import SessionManager from '../../../utils/managers/SessionManager';
import NavigationManager, { NavigationContext } from '../../../utils/core/NavigationManager';

/**
 * Loading页面
 * 
 * 功能：
 * 1. 展示加载进度
 * 2. 处理TokenManager和SessionManager的加载流程
 * 3. 处理错误情况，跳转到Error页面
 * 4. 加载完成后返回原页面
 */

Page({
  data: {
    // 当前步骤（0-based）
    currentStep: 0,
    
    // 步骤描述列表
    steps: [],
    
    // 是否显示错误
    isError: false,
    
    // 错误信息
    errorMessage: '',
    
    // 加载进度（0-100）
    progress: 0,
    
    // 当前状态描述
    statusText: '正在加载...'
  },

  // 页面实例变量
  _context: null,
  _tokenManager: null,
  _sessionManager: null,
  _unsubscribeToken: null,
  _unsubscribeSession: null,
  _navigationManager: null,
  _currentManager: null, // 当前正在处理的管理器

  /**
   * 页面加载
   */
  onLoad(options) {
    console.log('[Loading] 页面加载, options:', options);

    // 解析导航上下文
    this._context = NavigationContext.fromQuery(options);
    console.log('[Loading] 导航上下文:', this._context);

    // 获取管理器实例
    this._tokenManager = TokenManager.getInstance();
    this._sessionManager = SessionManager.getInstance();
    this._navigationManager = NavigationManager.getInstance();

    // 订阅状态变化
    this._subscribeStateChanges();

    // 开始加载流程
    this._startLoading();
  },

  /**
   * 页面卸载
   */
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
   * 订阅状态变化
   */
  _subscribeStateChanges() {
    // 订阅Token状态
    this._unsubscribeToken = this._tokenManager.subscribe((state, data) => {
      console.log('[Loading] Token状态变化:', state, data);
      if (this._currentManager === 'TokenManager') {
        this._updateProgress();
      }
    });

    // 订阅Session状态
    this._unsubscribeSession = this._sessionManager.subscribe((state, data) => {
      console.log('[Loading] Session状态变化:', state, data);
      if (this._currentManager === 'SessionManager') {
        this._updateProgress();
      }
    });
  },

  /**
   * 开始加载流程
   */
  async _startLoading() {
    console.log('[Loading] 开始加载流程');
    this.setData({ 
      isError: false, 
      errorMessage: '',
      currentStep: 0,
      progress: 0
    });

    try {
      // 判断需要加载什么
      const managerName = this._context.manager;
      
      if (managerName === 'TokenManager') {
        await this._loadToken();
      } else if (managerName === 'SessionManager') {
        await this._loadSession();
      } else {
        // 默认：Token + Session
        await this._loadToken();
        await this._loadSession();
      }

      // 加载完成
      console.log('[Loading] 加载完成');
      this.setData({ 
        progress: 100,
        statusText: '加载完成'
      });

      // 短暂延迟后返回
      setTimeout(() => {
        this._navigateBack();
      }, 300);

    } catch (error) {
      console.error('[Loading] 加载失败:', error);
      this._handleError(error);
    }
  },

  /**
   * 加载Token
   */
  async _loadToken() {
    console.log('[Loading] 加载Token');
    this._currentManager = 'TokenManager';
    
    // 设置步骤描述
    const steps = this._tokenManager.getStepDescriptions();
    this.setData({ 
      steps,
      statusText: '正在获取登录凭证...'
    });

    // 开始加载
    const result = await this._tokenManager.startInLoadingPage();
    
    if (!result.success) {
      throw result.error || new Error('Token加载失败');
    }

    console.log('[Loading] Token加载成功');
  },

  /**
   * 加载Session
   */
  async _loadSession() {
    console.log('[Loading] 加载Session');
    this._currentManager = 'SessionManager';
    
    // 设置步骤描述
    const steps = this._sessionManager.getStepDescriptions();
    this.setData({ 
      steps,
      statusText: '正在检查会话状态...'
    });

    // 开始加载
    const result = await this._sessionManager.startInLoadingPage();
    
    if (!result.success) {
      throw result.error || new Error('Session加载失败');
    }

    console.log('[Loading] Session加载成功');
  },

  /**
   * 更新进度
   */
  _updateProgress() {
    const manager = this._currentManager === 'TokenManager' 
      ? this._tokenManager 
      : this._sessionManager;
    
    const state = manager.getState();
    const steps = this.data.steps;
    
    // 根据状态计算当前步骤
    let currentStep = 0;
    let statusText = this.data.statusText;

    // 简单的状态到步骤的映射
    if (state === 'idle') {
      currentStep = 0;
    } else if (state === 'checking' || state === 'waiting_token') {
      currentStep = 1;
    } else if (state === 'loading' || state === 'fetching' || state === 'refreshing') {
      currentStep = 2;
    } else if (state === 'ready') {
      currentStep = steps.length - 1;
    } else if (state === 'failed') {
      currentStep = 2; // 重试中，保持在加载步骤
      statusText = '重试中...';
    }

    // 计算进度（基于步骤）
    const progress = steps.length > 0 
      ? Math.round((currentStep / steps.length) * 100)
      : 0;

    this.setData({ 
      currentStep, 
      progress,
      statusText: statusText || steps[currentStep] || '加载中...'
    });
  },

  /**
   * 处理错误
   */
  _handleError(error) {
    console.error('[Loading] 处理错误:', error);
    
    // 跳转到Error页面
    this._navigationManager.navigateToError(this._context, {
      message: error.message || '加载失败，请重试'
    });
  },

  /**
   * 返回原页面
   */
  _navigateBack() {
    console.log('[Loading] 返回原页面');
    this._navigationManager.navigateBack(this._context);
  },

  /**
   * 重试按钮点击（如果在loading页面显示错误）
   */
  onRetry() {
    console.log('[Loading] 重试');
    this._startLoading();
  }
});
