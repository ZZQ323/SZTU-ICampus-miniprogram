/**
 * 状态管理基类
 * 
 * 提供统一的状态管理接口，支持：
 * 1. 状态订阅与通知
 * 2. 自动检查与恢复（ensure功能）
 * 3. 错误处理与重试机制
 * 4. 页面跳转管理
 * 
 * 使用方式：
 * - TokenManager、SessionManager继承此类
 * - 业务页面的状态管理也可以继承此类
 */

import NavigationManager from './NavigationManager';

/**
 * 通用状态枚举
 */
export const CommonState = Object.freeze({
  IDLE: 'idle',           // 空闲状态
  CHECKING: 'checking',   // 检查中
  LOADING: 'loading',     // 加载中
  READY: 'ready',         // 就绪
  FAILED: 'failed',       // 失败（重试中）
  ERROR: 'error',         // 错误（需要用户介入）
});

/**
 * 状态管理器配置
 */
export class StateManagerConfig {
  constructor(options = {}) {
    this.name = options.name || 'StateManager';           // 管理器名称
    this.maxRetries = options.maxRetries || 3;            // 最大重试次数
    this.retryDelay = options.retryDelay || 1000;         // 重试延迟(ms)
    this.cacheTime = options.cacheTime || 5 * 60 * 1000;  // 缓存时间(ms)
    this.enableLogging = options.enableLogging !== false;  // 是否启用日志
  }
}

/**
 * 抽象状态管理器基类
 */
export class StateManager {
  constructor(config = {}) {
    if (new.target === StateManager) {
      throw new Error('StateManager是抽象类，不能直接实例化');
    }

    this._config = new StateManagerConfig(config);
    this._state = CommonState.IDLE;
    this._lastCheckTime = 0;
    this._lastError = null;
    
    // 订阅者列表
    this._listeners = new Set();
    
    // 正在进行的Promise
    this._pendingPromise = null;
    
    // 是否在loading/error页面中
    this._isInSpecialPage = false;
    
    // 等待者的回调
    this._waiters = {
      resolve: null,
      reject: null
    };

    this._navigationManager = NavigationManager.getInstance();
  }

  // ==================== 抽象方法（子类必须实现） ====================

  /**
   * 检查状态是否有效
   * @returns {Promise<boolean>}
   */
  async _checkValidity() {
    throw new Error('子类必须实现 _checkValidity 方法');
  }

  /**
   * 恢复/刷新状态
   * @returns {Promise<any>}
   */
  async _restore() {
    throw new Error('子类必须实现 _restore 方法');
  }

  /**
   * 获取当前状态数据（用于通知订阅者）
   * @returns {Object}
   */
  _getStatusData() {
    return {
      state: this._state,
      error: this._lastError?.message || null,
    };
  }

  /**
   * 获取步骤描述（用于loading页面展示）
   * @returns {Array<string>}
   */
  getStepDescriptions() {
    return ['检查状态', '恢复状态', '完成'];
  }

  // ==================== 核心方法 ====================

  /**
   * 【主入口】确保状态有效
   * 
   * 这是状态管理器的核心方法，会：
   * 1. 检查当前状态是否有效
   * 2. 如果无效，自动恢复
   * 3. 如果需要，跳转到loading页面
   * 
   * @returns {Promise<any>}
   */
  async ensure() {
    // 如果状态有效且缓存未过期，直接返回
    if (this._state === CommonState.READY && this._isCacheValid()) {
      this._log('状态有效，使用缓存');
      return this._getEnsureResult();
    }

    // 如果已经有正在进行的ensure，等待它完成
    if (this._pendingPromise) {
      this._log('等待现有ensure操作完成');
      return this._pendingPromise;
    }

    // 开始新的ensure操作
    this._pendingPromise = this._doEnsure();

    try {
      return await this._pendingPromise;
    } finally {
      this._pendingPromise = null;
    }
  }

  /**
   * 执行ensure逻辑
   * @private
   */
  async _doEnsure() {
    this._log('开始ensure操作');
    this._setState(CommonState.CHECKING);

    try {
      // 检查状态是否有效
      const isValid = await this._checkValidity();
      
      if (isValid) {
        this._log('状态检查通过');
        this._lastCheckTime = Date.now();
        this._setState(CommonState.READY);
        return this._getEnsureResult();
      }

      // 状态无效，需要恢复
      this._log('状态无效，需要恢复');

      // 如果在特殊页面（loading/error），直接恢复
      if (this._isInSpecialPage) {
        return await this._restoreWithRetry();
      }

      // 否则，跳转到loading页面
      return await this._navigateToLoading();

    } catch (error) {
      this._log('ensure操作失败', error);
      this._lastError = error;
      this._setState(CommonState.ERROR);
      throw error;
    }
  }

  /**
   * 跳转到loading页面
   * @private
   */
  _navigateToLoading() {
    return new Promise((resolve, reject) => {
      this._waiters.resolve = resolve;
      this._waiters.reject = reject;

      const context = this._navigationManager.saveContext({
        manager: this._config.name,
        action: 'ensure'
      });

      this._navigationManager.navigateToLoading(context);
    });
  }

  /**
   * 【Loading页面调用】在loading页面中开始恢复
   */
  async startInLoadingPage() {
    this._log('在Loading页面中开始恢复');
    this._isInSpecialPage = true;
    this._lastError = null;

    try {
      // 先检查
      this._setState(CommonState.CHECKING);
      const isValid = await this._checkValidity();

      if (isValid) {
        this._log('检查通过，无需恢复');
        this._lastCheckTime = Date.now();
        this._setState(CommonState.READY);
        this._resolveWaiters(this._getEnsureResult());
        return { success: true };
      }

      // 需要恢复
      const result = await this._restoreWithRetry();
      this._resolveWaiters(result);
      return { success: true, result };

    } catch (error) {
      this._log('Loading页面恢复失败', error);
      this._lastError = error;
      this._setState(CommonState.ERROR);
      this._rejectWaiters(error);
      return { success: false, error };

    } finally {
      this._isInSpecialPage = false;
    }
  }

  /**
   * 带重试的恢复
   * @private
   */
  async _restoreWithRetry() {
    let lastError = null;

    for (let attempt = 1; attempt <= this._config.maxRetries; attempt++) {
      this._log(`恢复尝试 ${attempt}/${this._config.maxRetries}`);
      this._setState(CommonState.LOADING);

      try {
        const result = await this._restore();
        this._log('恢复成功');
        this._lastCheckTime = Date.now();
        this._setState(CommonState.READY);
        return result;

      } catch (error) {
        lastError = error;
        this._log(`恢复失败 (${attempt}/${this._config.maxRetries})`, error);

        if (attempt < this._config.maxRetries) {
          this._setState(CommonState.FAILED);
          await this._delay(this._config.retryDelay * attempt);
        }
      }
    }

    // 所有重试都失败了
    this._lastError = lastError;
    this._setState(CommonState.ERROR);
    throw lastError || new Error(`${this._config.name}恢复失败`);
  }

  /**
   * 【Error页面调用】单次重试
   */
  async retryOnce() {
    this._log('Error页面单次重试');
    this._lastError = null;
    this._setState(CommonState.LOADING);

    try {
      const result = await this._restore();
      this._lastCheckTime = Date.now();
      this._setState(CommonState.READY);
      return { success: true, result };

    } catch (error) {
      this._lastError = error;
      this._setState(CommonState.ERROR);
      return { success: false, error };
    }
  }

  // ==================== 状态管理 ====================

  /**
   * 设置状态
   * @private
   */
  _setState(state) {
    if (this._state !== state) {
      const oldState = this._state;
      this._state = state;
      this._log(`状态变化: ${oldState} -> ${state}`);
      this._notifyStateChange();
    }
  }

  /**
   * 通知所有订阅者状态变化
   * @private
   */
  _notifyStateChange() {
    const data = this._getStatusData();
    this._listeners.forEach(callback => {
      try {
        callback(this._state, data);
      } catch (error) {
        console.error(`[${this._config.name}] 订阅者回调错误:`, error);
      }
    });
  }

  /**
   * 订阅状态变化
   * @param {Function} callback 回调函数 (state, data) => void
   * @returns {Function} 取消订阅函数
   */
  subscribe(callback) {
    this._listeners.add(callback);
    // 立即调用一次，同步当前状态
    callback(this._state, this._getStatusData());
    // 返回取消订阅函数
    return () => this._listeners.delete(callback);
  }

  // ==================== 辅助方法 ====================

  /**
   * 检查缓存是否有效
   * @private
   */
  _isCacheValid() {
    return Date.now() - this._lastCheckTime < this._config.cacheTime;
  }

  /**
   * 获取ensure的结果（子类可覆盖）
   * @private
   */
  _getEnsureResult() {
    return true;
  }

  /**
   * 解决等待者
   * @private
   */
  _resolveWaiters(result) {
    if (this._waiters.resolve) {
      this._waiters.resolve(result);
      this._waiters.resolve = null;
      this._waiters.reject = null;
    }
  }

  /**
   * 拒绝等待者
   * @private
   */
  _rejectWaiters(error) {
    if (this._waiters.reject) {
      this._waiters.reject(error);
      this._waiters.resolve = null;
      this._waiters.reject = null;
    }
  }

  /**
   * 延迟
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 日志输出
   * @private
   */
  _log(...args) {
    if (this._config.enableLogging) {
      console.log(`[${this._config.name}]`, ...args);
    }
  }

  /**
   * 重新验证（清除缓存并重新ensure）
   */
  async revalidate() {
    this._log('重新验证');
    this._lastCheckTime = 0;
    this._setState(CommonState.IDLE);
    return this.ensure();
  }

  /**
   * 清除状态
   */
  clear() {
    this._log('清除状态');
    this._lastCheckTime = 0;
    this._lastError = null;
    this._setState(CommonState.IDLE);
  }

  // ==================== Getter方法 ====================

  getState() {
    return this._state;
  }

  getLastError() {
    return this._lastError;
  }

  isReady() {
    return this._state === CommonState.READY && this._isCacheValid();
  }

  getConfig() {
    return { ...this._config };
  }
}

export default StateManager;
