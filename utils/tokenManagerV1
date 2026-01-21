// import StateManager from "statemanager";
import CONSTANT from "constant";    
//服务器api地址

/**
 * Token 状态枚举
 */
export const TokenState = Object.freeze({
    IDLE: 0,                    // 空闲/初始状态
    CHECKING: 1,                // 正在检查 token 有效性
    REFRESHING: 2,              // 正在获取新 token
    RETRYING: 3,                // 获取失败，正在重试
    READY: 4,                   // token 有效，可以使用
    FAILED: 5,                  // 超过最大重试次数，彻底失败
});

/** Token 管理器
 * 
 * 核心职责：确保 token 有效
 * - 有 token 就检查有效性
 * - 无效或没有就获取新 token
 * - 获取失败则重试，直到成功或达到最大重试次数
 * 
 * 使用事件通知机制，订阅者无需轮询状态
 * 
 * @example
 * const manager = TokenManager.getInstance();
 * 
 * // 监听状态变化
 * manager.on('stateChange', ({ state, prevState, token, error }) => {
 *     console.log(`状态: ${prevState} -> ${state}`);
 * });
 * 
 * // 监听特定状态
 * manager.on('state:ready', ({ token }) => {
 *     console.log('Token 已就绪:', token);
 * });
 * 
 * // 等待 token 就绪
 * await manager.ensureToken();
 */
export class TokenManager {
    // 单例实例
    static _instance = null;
    /**
     * 获取单例实例
     * @param {Object} options - 配置选项
     * @returns {TokenManager}
     */
    static getInstance(options = {}) {
        if (!TokenManager._instance) {
            TokenManager._instance = new TokenManager(options);
        }
        return TokenManager._instance;
    }

    /**
     * 销毁单例（主要用于测试）
     */
    static destroyInstance() {
        if (TokenManager._instance) {
            TokenManager._instance.destroy();
            TokenManager._instance = null;
        }
    }

    /**
     * @param {Object} options - 配置选项
     * @param {string} options.baseURL - API 基础地址
     * @param {number} options.maxRetries - 最大重试次数，默认 5
     * @param {number} options.retryDelay - 重试间隔(ms)，默认 2000
     * @param {string} options.storageKey - token 存储键名，默认 'token'
     * @param {boolean} options.autoStart - 是否自动开始检查，默认 true
     */
    constructor(options = {}) {
        const {
            baseURL = CONSTANT.baseURL,
            maxRetries = 5,
            retryDelay = 2000,
            storageKey = 'token',
            autoStart = true,
        } = options;
        // 配置
        this._config = { baseURL, maxRetries, retryDelay, storageKey };
        // 状态
        this._state = TokenState.IDLE;
        this._token = null;
        this._error = null;
        this._retryCount = 0;
        this._retryTimer = null;
        // 事件监听器
        this._listeners = new Map();
        this._onceListeners = new Map();
        // Promise 队列（用于 ensureToken）
        this._pendingPromises = [];
        // 自动开始
        if (autoStart) {
            this.checkToken();
        }
    }

    // ==================== 核心方法 ====================

    /** 确保 token 有效（主要对外接口）
     * 如果 token 已就绪则立即返回，否则等待获取完成
     * 
     * @param {number} timeout - 超时时间(ms)，默认 30000
     * @returns {Promise<string>} 有效的 token
     * @throws {Error} 超时或获取失败
     */
    async ensureToken(timeout = 30000) {
        // 已就绪，直接返回
        if (this._state === TokenState.READY && this._token)return this._token;
        // 已失败，直接抛错
        if (this._state === TokenState.FAILED)throw this._error || new Error('Token 获取失败');
        // 等待状态变为 READY 或 FAILED
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Token 获取超时 (${timeout}ms)`));
            }, timeout);
            const cleanup = () => {
                clearTimeout(timer);
                this.off('state:ready', onReady);
                this.off('state:failed', onFailed);
            };
            const onReady = ({ token }) => {
                cleanup();
                resolve(token);
            };
            const onFailed = ({ error }) => {
                cleanup();
                reject(error || new Error('Token 获取失败'));
            };
            this.once('state:ready', onReady);
            this.once('state:failed', onFailed);
            // 如果当前是 IDLE ，触发检查
            if (this._state === TokenState.IDLE) {
                this.checkToken();
            }
        });
    }

    /**
     * 检查 token 有效性
     * @returns {Promise<void>}
     */
    async checkToken() {
        // 防止重复检查
        if (this._state === TokenState.CHECKING || 
            this._state === TokenState.REFRESHING ||
            this._state === TokenState.RETRYING) {
            return;
        }
        this._setState(TokenState.CHECKING);
        try {
            const token = this._getStoredToken();
            // 没有 token，直接获取
            if (!token) {
                await this._refreshToken();
                return;
            }
            // 有 token，验证有效性
            const isValid = await this._validateToken(token);
            if (isValid) {
                this._token = token;
                this._setState(TokenState.READY);
            } else {
                // token 无效，重新获取
                await this._refreshToken();
            }
        } catch (error) {
            console.error('[TokenManager] checkToken error:', error);
            await this._handleError(error);
        }
    }

    /**
     * 强制刷新 token
     * @returns {Promise<string>}
     */
    async forceRefresh() {
        this._retryCount = 0;
        this._clearRetryTimer();
        await this._refreshToken();
        return this._token;
    }

    /** 获取当前 token（不触发获取流程）
     * @returns {string|null}
     */
    getToken() {
        return this._token;
    }

    /** 获取当前状态
     * @returns {string}
     */
    getState() {
        return this._state;
    }

    /** 获取状态详情
     * @returns {Object}
     */
    getStatus() {
        return {
            state: this._state,
            token: this._token,
            error: this._error,
            retryCount: this._retryCount,
            maxRetries: this._config.maxRetries,
        };
    }

    // ==================== 私有方法 ====================

    /**  设置状态并触发通知
     * @private
     */
    _setState(newState, extra = {}) {
        const prevState = this._state;
        if (prevState === newState) return;

        this._state = newState;

        const payload = {
            state: newState,
            prevState,
            token: this._token,
            error: this._error,
            retryCount: this._retryCount,
            ...extra,
        };
        // 触发通用状态变化事件
        this._emit('stateChange', payload);
        // 触发特定状态事件
        this._emit(`state:${newState}`, payload);
    }

    /** 获取存储的 token
     * @private
     */
    _getStoredToken() {
        try {
            const token = wx.getStorageSync(this._config.storageKey);
            return token && token.trim() ? token.trim() : null;
        } catch (e) {
            console.error('[TokenManager] getStorageSync error:', e);
            return null;
        }
    }

    /** 存储 token
     * @private
     */
    _setStoredToken(token) {
        try {
            wx.setStorageSync(this._config.storageKey, token);
        } catch (e) {
            console.error('[TokenManager] setStorageSync error:', e);
        }
    }

    /** 验证 token 有效性
     * @private
     */
    async _validateToken(token) {
        return new Promise((resolve) => {
            wx.request({
                url: `${this._config.baseURL}/wx-auth/v1/active`,
                method: 'GET',
                header: {
                    'Content-Type': 'application/json',
                    'token': token,
                },
                success: (res) => {
                    resolve(res.statusCode === 200);
                },
                fail: () => {
                    resolve(false);
                },
            });
        });
    }

    /** 获取新 token
     * @private
     */
    async _refreshToken() {
        this._setState(TokenState.REFRESHING);

        return new Promise((resolve, reject) => {
            wx.login({
                success: (loginRes) => {
                    if (!loginRes.code) {
                        reject(new Error('wx.login 获取 code 失败'));
                        return;
                    }

                    wx.request({
                        url: `${this._config.baseURL}/wx-auth/v1/get-token`,
                        method: 'POST',
                        header: { 'Content-Type': 'application/json' },
                        data: { code: loginRes.code },
                        success: (res) => {
                            if (res.statusCode === 200 && res.data?.data?.token) {
                                const token = res.data.data.token;
                                this._token = token;
                                this._setStoredToken(token);
                                this._retryCount = 0;
                                this._error = null;
                                this._setState(TokenState.READY);
                                resolve(token);
                            } else {
                                const error = new Error(res.data?.message || 'Token 获取失败');
                                this._handleError(error).then(() => reject(error));
                            }
                        },
                        fail: (err) => {
                            const error = new Error(err.errMsg || '网络请求失败');
                            this._handleError(error).then(() => reject(error));
                        },
                    });
                },
                fail: (err) => {
                    const error = new Error(err.errMsg || 'wx.login 失败');
                    this._handleError(error).then(() => reject(error));
                },
            });
        });
    }

    /** 处理错误，决定重试或失败
     * @private
     */
    async _handleError(error) {
        this._error = error;
        this._retryCount++;

        if (this._retryCount >= this._config.maxRetries) {
            // 达到最大重试次数，标记失败
            this._setState(TokenState.FAILED);
            return;
        }

        // 开始重试
        this._setState(TokenState.RETRYING);
        
        return new Promise((resolve) => {
            this._retryTimer = setTimeout(async () => {
                this._retryTimer = null;
                try {
                    await this._refreshToken();
                } catch (e) {
                    // 错误已在 _refreshToken 中处理
                }
                resolve();
            }, this._config.retryDelay);
        });
    }

    /**  清除重试定时器
     * @private
     */
    _clearRetryTimer() {
        if (this._retryTimer) {
            clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }
    }

    // ==================== 事件系统 ====================

    /** 注册事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听函数
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('callback must be a function');
        }

        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    /** 注册一次性事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听函数
     */
    once(event, callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('callback must be a function');
        }

        if (!this._onceListeners.has(event)) {
            this._onceListeners.set(event, new Set());
        }
        this._onceListeners.get(event).add(callback);

        return () => {
            if (this._onceListeners.has(event)) {
                this._onceListeners.get(event).delete(callback);
            }
        };
    }

    /** 移除事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).delete(callback);
            if (this._listeners.get(event).size === 0) {
                this._listeners.delete(event);
            }
        }

        if (this._onceListeners.has(event)) {
            this._onceListeners.get(event).delete(callback);
            if (this._onceListeners.get(event).size === 0) {
                this._onceListeners.delete(event);
            }
        }
    }

    /** 触发事件
     * @private
     */
    _emit(event, payload) {
        // 触发普通监听器
        if (this._listeners.has(event)) {
            this._listeners.get(event).forEach((callback) => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[TokenManager] Error in "${event}" listener:`, error);
                }
            });
        }

        // 触发一次性监听器
        if (this._onceListeners.has(event)) {
            const callbacks = this._onceListeners.get(event);
            this._onceListeners.delete(event);
            callbacks.forEach((callback) => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[TokenManager] Error in "${event}" once listener:`, error);
                }
            });
        }
    }

    /** 清除所有事件监听器
     */
    clearAllListeners() {
        this._listeners.clear();
        this._onceListeners.clear();
    }

    /** 获取事件监听器数量
     * @param {string} [event] - 事件名称，不传则返回总数
     */
    listenerCount(event) {
        if (event) {
            const normal = this._listeners.get(event)?.size || 0;
            const once = this._onceListeners.get(event)?.size || 0;
            return normal + once;
        }

        let total = 0;
        for (const listeners of this._listeners.values()) {
            total += listeners.size;
        }
        for (const listeners of this._onceListeners.values()) {
            total += listeners.size;
        }
        return total;
    }

    // ==================== 便捷方法 ====================

    /** 等待特定状态
     * @param {string} targetState - 目标状态
     * @param {number} timeout - 超时时间(ms)
     * @returns {Promise<Object>}
     */
    waitForState(targetState, timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (this._state === targetState) {
                resolve(this.getStatus());
                return;
            }

            const timer = setTimeout(() => {
                unsubscribe();
                reject(new Error(`等待状态 "${targetState}" 超时`));
            }, timeout);

            const unsubscribe = this.on('stateChange', (payload) => {
                if (payload.state === targetState) {
                    clearTimeout(timer);
                    unsubscribe();
                    resolve(payload);
                }
            });
        });
    }

    /** 重置管理器状态
     */
    reset() {
        this._clearRetryTimer();
        this._token = null;
        this._error = null;
        this._retryCount = 0;
        this._setState(TokenState.IDLE);
    }

    /**  销毁管理器
     */
    destroy() {
        this._clearRetryTimer();
        this.clearAllListeners();
        this._token = null;
        this._error = null;
    }
}

// 默认导出单例获取方法
export default TokenManager;

