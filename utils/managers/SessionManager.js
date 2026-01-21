/**
 * Session管理器
 * 
 * 负责：
 * 1. 管理后端与学校网站的会话session
 * 2. 管理登录状态
 * 3. 依赖TokenManager（必须先有token才能操作session）
 * 
 * API:
 * - /auth/v1/status/session (GET) - 检查session有效性
 * - /auth/v1/cookie/refresh (POST) - 刷新session
 * 
 * 注意：
 * - session保存在后端，不能直接获取
 * - 如果之前登录过，refresh可能直接返回已登录状态
 */

import StateManager, { CommonState } from '../core/StateManager';
import HttpClient from '../core/HttpClient';
import TokenManager from './TokenManager';
import NavigationManager from '../core/NavigationManager';

/**
 * Session特有状态
 */
export const SessionState = {
  ...CommonState,
  WAITING_TOKEN: 'waiting_token',  // 等待token
};

/**
 * Session管理器（单例）
 */
export class SessionManager extends StateManager {
  static _instance = null;

  static getInstance() {
    if (!SessionManager._instance) {
      SessionManager._instance = new SessionManager();
    }
    return SessionManager._instance;
  }

  constructor() {
    super({
      name: 'SessionManager',
      maxRetries: 3,
      retryDelay: 1000,
      cacheTime: 5 * 60 * 1000, // 5分钟缓存
      enableLogging: true
    });

    this._isValid = false;
    this._isLogined = false;  // 登录状态
    this._tokenManager = TokenManager.getInstance();
    this._httpClient = HttpClient.getInstance();
    this._navigationManager = NavigationManager.getInstance();

    // 登录相关的等待者
    this._loginWaiters = {
      resolve: null,
      reject: null
    };
  }

  // ==================== 实现StateManager抽象方法 ====================

  /**
   * 检查session有效性
   * @override
   */
  async _checkValidity() {
    this._log('检查Session有效性');

    // 先确保有token
    this._setState(SessionState.WAITING_TOKEN);
    try {
      await this._tokenManager.ensureToken();
    } catch (error) {
      this._log('获取Token失败:', error.message);
      throw new Error(`获取Token失败: ${error.message}`);
    }

    // 检查session
    this._setState(CommonState.CHECKING);
    try {
      const result = await this._httpClient.request({
        api: '/auth/v1/status/session',
        method: 'GET',
        autoNavigateToError: false,
        showToast: false
      });

      // 解析响应
      const isValid = result?.valid === true;
      const isLogined = result?.Logined === true || result?.logined === true;

      this._log('Session检查结果:', { isValid, isLogined });

      if (isValid) {
        this._isValid = true;
        this._isLogined = isLogined;
        return true;
      }

      return false;

    } catch (error) {
      this._log('Session检查失败:', error.message);
      return false;
    }
  }

  /**
   * 刷新session
   * @override
   */
  async _restore() {
    this._log('刷新Session');

    // 确保有token
    await this._tokenManager.ensureToken();

    // 刷新session
    try {
      const result = await this._httpClient.request({
        api: '/auth/v1/cookie/refresh',
        method: 'POST',
        autoNavigateToError: false,
        showToast: false
      });

      // 解析响应
      const success = result?.success !== false;
      const isLogined = result?.data?.Logined === true || 
                       result?.data?.logined === true ||
                       result?.Logined === true ||
                       result?.logined === true;

      this._log('Session刷新结果:', { success, isLogined });

      if (!success) {
        throw new Error('Session刷新失败');
      }

      this._isValid = true;
      this._isLogined = isLogined;
      
      return { success: true, isLogined };

    } catch (error) {
      this._log('Session刷新失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取状态数据
   * @override
   */
  _getStatusData() {
    return {
      ...super._getStatusData(),
      isValid: this._isValid,
      isLogined: this._isLogined,
      tokenState: this._tokenManager.getState()
    };
  }

  /**
   * 获取步骤描述
   * @override
   */
  getStepDescriptions() {
    return [
      '等待登录凭证',
      '检查会话状态',
      '刷新会话',
      '完成'
    ];
  }

  /**
   * 获取ensure的结果
   * @override
   */
  _getEnsureResult() {
    return {
      valid: this._isValid,
      logined: this._isLogined
    };
  }

  // ==================== Session特有方法 ====================

  /**
   * 确保session有效
   */
  async ensureSession() {
    return this.ensure();
  }

  /**
   * 确保已登录
   * 
   * 这个方法会：
   * 1. 先确保session有效
   * 2. 检查是否已登录
   * 3. 如果未登录，跳转到登录页面
   */
  async ensureLogin() {
    this._log('确保已登录');

    // 先确保session有效
    await this.ensureSession();

    // 检查是否已登录
    if (this._isLogined) {
      this._log('已登录');
      return true;
    }

    // 未登录，跳转到登录页面
    this._log('未登录，跳转到登录页面');
    return this._navigateToLogin();
  }

  /**
   * 跳转到登录页面
   * @private
   */
  _navigateToLogin() {
    return new Promise((resolve, reject) => {
      this._loginWaiters.resolve = resolve;
      this._loginWaiters.reject = reject;

      const context = this._navigationManager.saveContext({
        manager: 'SessionManager',
        action: 'login'
      });

      const queryString = context.toQueryString();
      
      wx.navigateTo({
        url: `/pages/person/login/index?${queryString}`,
        fail: (err) => {
          console.error('[SessionManager] 跳转登录页面失败:', err);
          reject(new Error('跳转登录页面失败'));
        }
      });
    });
  }

  /**
   * 【Login页面调用】登录成功
   */
  onLoginSuccess() {
    this._log('登录成功');
    this._isLogined = true;
    this._lastCheckTime = Date.now();
    this._setState(CommonState.READY);

    if (this._loginWaiters.resolve) {
      this._loginWaiters.resolve(true);
      this._loginWaiters.resolve = null;
      this._loginWaiters.reject = null;
    }
  }

  /**
   * 【Login页面调用】登录失败
   */
  onLoginFailed(error) {
    this._log('登录失败:', error);

    if (this._loginWaiters.reject) {
      this._loginWaiters.reject(error || new Error('登录失败'));
      this._loginWaiters.resolve = null;
      this._loginWaiters.reject = null;
    }
  }

  /**
   * 检查是否已登录
   */
  isLogined() {
    return this._isLogined;
  }

  /**
   * 检查session是否有效
   */
  isSessionValid() {
    return this._isValid && this._isCacheValid();
  }

  /**
   * 清除session
   * @override
   */
  clear() {
    super.clear();
    this._isValid = false;
    this._isLogined = false;
  }
}

export default SessionManager;
