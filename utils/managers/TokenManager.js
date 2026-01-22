/**
 * Token管理器
 * 
 * 负责：
 * 1. 管理设备与后端的会话token
 * 2. 自动检查token有效性
 * 3. 自动获取和刷新token
 * 4. 持久化存储token
 * 
 * API:
 * - /wx-auth/v1/get-token (POST) - 获取token
 * - /wx-auth/v1/active (GET) - 验证token有效性
 */

import  { StateManager,CommonState } from '../core/StateManager';
import HttpClient from '../core/HttpClient';

/**
 * Token管理器（单例）
 */
export class TokenManager extends StateManager {
  static _instance = null;

  static getInstance() {
    if (!TokenManager._instance) {
      TokenManager._instance = new TokenManager();
    }
    return TokenManager._instance;
  }

  constructor() {
    super({
      name: 'TokenManager',
      maxRetries: 0,
      retryDelay: 1000,
      cacheTime: 5 * 60 * 1000, // 5分钟缓存
      enableLogging: true
    });

    this._storageKey = 'auth_token';
    this._token = null;
    this._httpClient = HttpClient.getInstance();
  }

  // ==================== 实现StateManager抽象方法 ====================

  /**
   * 检查token有效性
   * @override
   */
  async _checkValidity() {
    this._log('检查Token有效性');

    // 先从存储中获取token
    const storedToken = this._getStoredToken();
    if (!storedToken) {
      this._log('存储中没有Token');
      return false;
    }

    // 调用API验证token
    try {
      await this._httpClient.request({
        api: '/wx-auth/v1/active',
        method: 'GET',
        header: { 'token': storedToken },
        autoAddToken: false,  // 手动添加token
        autoNavigateToError: false,  // 不自动跳转error页面
        showToast: false  // 不显示toast
      });

      this._log('Token有效');
      this._token = storedToken;
      return true;

    } catch (error) {
      this._log('Token无效或验证失败:', error.message);
      return false;
    }
  }

  /**
   * 获取新token
   * @override
   */
  async _restore() {
    this._log('获取新Token');

    return new Promise((resolve, reject) => {
      // 第一步：微信登录获取code
      wx.login({
        success: async (loginRes) => {
          if (!loginRes.code) {
            reject(new Error('微信登录失败：无code'));
            return;
          }
          try {
            // 第二步：用code换取token
            const response = await this._httpClient.request({
              api: '/wx-auth/v1/get-token',
              method: 'POST',
              data: { wxCode: loginRes.code },
              autoAddToken: false,  // 不需要token
              autoNavigateToError: false,  // 不自动跳转error页面
              showToast: false  // 不显示toast
            });
            if (response && response.data && response.data.token) {
              const token = response.data.token;
              this._token = token;
              this._setStoredToken(token);
              this._log('Token获取成功');
              resolve(token);
            } else {
              reject(new Error('Token获取失败，请退出登录界面再点击登录界面进行重试！'));
            }
          } catch (error) {
            reject(new Error(`Token获取失败：${error.message}`));
          }
        },
        fail: (error) => {
          reject(new Error(`微信登录失败：${error.errMsg || '未知错误'}`));
        }
      });
    });
  }

  /**
   * 获取状态数据
   * @override
   */
  _getStatusData() {
    return {
      ...super._getStatusData(),
      hasToken: !!this._token,
      tokenPreview: this._token ? `****${this._token.slice(-4)}` : null
    };
  }

  /**
   * 获取步骤描述
   * @override
   */
  getStepDescriptions() {
    return [
      '检查登录凭证',
      '微信登录',
      '获取凭证',
      '完成'
    ];
  }

  /**
   * 获取ensure的结果
   * @override
   */
  _getEnsureResult() {
    return this._token;
  }

  // ==================== Token特有方法 ====================

  /**
   * 主入口：确保有有效的token
   * 这是其他地方调用的主要方法
   */
  async ensureToken() {
    return this.ensure();
  }

  /**
   * 获取当前token（不检查有效性）
   */
  getCurrentToken() {
    return this._token;
  }

  /**
   * 清除token
   * @override
   */
  clear() {
    super.clear();
    this._token = null;
    this._removeStoredToken();
  }

  // ==================== 存储相关 ====================

  /**
   * 从存储获取token
   * @private
   */
  _getStoredToken() {
    try {
      return wx.getStorageSync(this._storageKey) || null;
    } catch (error) {
      console.error('[TokenManager] 读取存储失败:', error);
      return null;
    }
  }

  /**
   * 保存token到存储
   * @private
   */
  _setStoredToken(token) {
    try {
      wx.setStorageSync(this._storageKey, token);
    } catch (error) {
      console.error('[TokenManager] 保存存储失败:', error);
    }
  }

  /**
   * 从存储删除token
   * @private
   */
  _removeStoredToken() {
    try {
      wx.removeStorageSync(this._storageKey);
    } catch (error) {
      console.error('[TokenManager] 删除存储失败:', error);
    }
  }
}

export default TokenManager;
