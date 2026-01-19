// auth-manager.js
// 重构的认证状态管理器 - 基于状态机模式
import { http } from 'http.js';
import baseURL from '../utils/constant';

// =====================================================
// API 配置
// =====================================================
const API_URLS = {
    getToken: "/wx-auth/v1/get-token",
    tokenActive: "/wx-auth/v1/active",
    sessionActive: "/auth/v1/status/session",
    sessionRefresh: "/auth/v1/cookie/refresh",
    getPossibleUsrId: "/auth/v1/history",
    getSms: "/auth/v1/request/sms",
    loginUsrPasswd: "/auth/v1/login/passwd",
    loginSms: "/auth/v1/login/sms",
    logout: "/auth/v1/logout",
};

// =====================================================
// 状态定义
// =====================================================
export const AuthState = {
    // 初始状态
    IDLE: 'idle',

    // Token 相关状态
    TOKEN_CHECKING: 'token_checking',
    TOKEN_REFRESHING: 'token_refreshing',
    TOKEN_VALID: 'token_valid',
    TOKEN_INVALID: 'token_invalid',

    // Session 相关状态
    SESSION_CHECKING: 'session_checking',
    SESSION_REFRESHING: 'session_refreshing',
    SESSION_VALID: 'session_valid',       // 已登录
    SESSION_EXPIRED: 'session_expired',   // 未登录/需要登录

    // 错误状态
    ERROR: 'error',

    // 重试状态
    RETRYING: 'retrying',
};

// 步骤定义（用于指定从哪个步骤开始）
export const AuthStep = {
    TOKEN: 'token',
    SESSION: 'session',
};

// =====================================================
// AuthManager 类
// =====================================================
class AuthManager {
    constructor() {
        // 单例检查
        if (AuthManager.instance) {
            return AuthManager.instance;
        }
        AuthManager.instance = this;

        // 状态
        this._state = AuthState.IDLE;
        this._token = null;
        this._isLoggedIn = false;

        // 配置
        this._baseURL = baseURL;
        this._maxRetries = 3;
        this._retryInterval = 5000;

        // 内部状态
        this._currentRetry = 0;
        this._retryTimer = null;
        this._isProcessing = false;

        // 事件监听器
        this._listeners = new Map();

        // 错误信息
        this._lastError = null;

        // 状态历史（调试用）
        this._stateHistory = [];
    }

    // =====================================================
    // 初始化
    // =====================================================

    /**
     * 初始化 AuthManager
     * @param {Object} options - 配置选项
     * @param {string} options.baseURL - API 基础 URL
     * @param {number} [options.maxRetries=3] - 最大重试次数
     * @param {number} [options.retryInterval=5000] - 重试间隔（毫秒）
     */
    init(options = {}) {
        this._baseURL = options.baseURL || baseURL;
        this._maxRetries = options.maxRetries ?? 3;
        this._retryInterval = options.retryInterval ?? 5000;
        // 尝试从本地存储恢复 token
        try {
            this._token = wx.getStorageSync('token') || null;
        } catch (e) {
            this._token = null;
        }
        console.log('[AuthManager] 初始化完成', { baseURL: this._baseURL });
        return this;
    }

    // =====================================================
    // 公共 API
    // =====================================================

    /**
     * 获取当前状态
     */
    get state() {
        return this._state;
    }

    /**
     * 获取当前 token
     */
    get token() {
        return this._token;
    }

    /**
     * 是否已登录
     */
    get isLoggedIn() {
        return this._isLoggedIn;
    }

    /**
     * 获取最后的错误信息
     */
    get lastError() {
        return this._lastError;
    }

    /**
     * 获取状态的可读描述（用于 UI 展示）
     */
    get stateDescription() {
        const descriptions = {
            [AuthState.IDLE]: '等待中',
            [AuthState.TOKEN_CHECKING]: '正在检查凭证...',
            [AuthState.TOKEN_REFRESHING]: '正在刷新凭证...',
            [AuthState.TOKEN_VALID]: '凭证有效',
            [AuthState.TOKEN_INVALID]: '凭证无效',
            [AuthState.SESSION_CHECKING]: '正在检查登录状态...',
            [AuthState.SESSION_REFRESHING]: '正在刷新会话...',
            [AuthState.SESSION_VALID]: '已登录',
            [AuthState.SESSION_EXPIRED]: '请登录',
            [AuthState.ERROR]: `出错: ${this._lastError?.message || '未知错误'}`,
            [AuthState.RETRYING]: `重试中 (${this._currentRetry}/${this._maxRetries})...`,
        };
        return descriptions[this._state] || '未知状态';
    }

    /**
     * 获取当前重试信息
     */
    get retryInfo() {
        return {
            current: this._currentRetry,
            max: this._maxRetries,
            isRetrying: this._retryTimer !== null,
        };
    }

    // =====================================================
    // 核心方法：从指定步骤开始检查
    // =====================================================

    /**
     * 从指定步骤开始检查
     * @param {string} step - 开始的步骤 (AuthStep.TOKEN 或 AuthStep.SESSION)
     * @param {Object} options - 选项
     * @param {boolean} [options.autoRetry=true] - 是否自动重试
     * @param {boolean} [options.force=false] - 是否强制执行（忽略 isProcessing）
     * @returns {Promise<Object>} 检查结果
     */
    async check(step = AuthStep.TOKEN, options = {}) {
        const { autoRetry = true, force = false } = options;

        // 防止重复执行
        if (this._isProcessing && !force) {
            console.log('[AuthManager] 已有检查在进行中，跳过');
            return { success: false, reason: 'already_processing' };
        }
        this._isProcessing = true;
        this._stopRetry(); // 清除可能存在的重试定时器
        try {
            let result;
            if (step === AuthStep.SESSION) {
                // 从 Session 检查开始
                result = await this._checkSession();

                // 如果 Session 检查发现 Token 问题，自动回退
                if (result.needTokenRefresh) {
                    console.log('[AuthManager] Session 检查发现需要刷新 Token，回退执行');
                    result = await this._checkToken();
                    if (result.success) {
                        result = await this._checkSession();
                    }
                }
            } else {
                // 从 Token 检查开始
                result = await this._checkToken();
                if (result.success) {
                    result = await this._checkSession();
                }
            }
            // 检查是否需要重试
            if (!result.success && autoRetry && result.retryable !== false) {
                this._startRetry(step);
            }
            return result;
        } catch (error) {
            this._setError(error);
            if (autoRetry) {
                this._startRetry(step);
            }
            return { success: false, error };
        } finally {
            this._isProcessing = false;
        }
    }

    /**
     * 确保 Token 有效（用于 API 调用前）
     * 这是一个快速检查方法，会在需要时自动刷新
     * @returns {Promise<string|null>} 有效的 token 或 null
     */
    async ensureToken() {
        // 如果当前没有 token，尝试获取
        if (!this._token) {
            const result = await this.check(AuthStep.TOKEN, { autoRetry: false });
            return result.success ? this._token : null;
        }
        // 如果有 token，先尝试验证
        const isValid = await this._validateToken(this._token);
        if (isValid) {
            return this._token;
        }
        // Token 无效，尝试刷新
        const result = await this._refreshToken();
        return result.success ? this._token : null;
    }

    /**
     * 确保已登录
     * @returns {Promise<boolean>} 是否已登录
     */
    async ensureLoggedIn() {
        const result = await this.check(AuthStep.SESSION, { autoRetry: false });
        return result.success && this._isLoggedIn;
    }

    /**
     * 停止所有重试
     */
    stopRetry() {
        this._stopRetry();
    }

    /**
     * 手动重试
     */
    async retry(step = AuthStep.TOKEN) {
        this._currentRetry = 0;
        return this.check(step, { autoRetry: true, force: true });
    }

    /**
     * 重置状态
     */
    reset() {
        this._stopRetry();
        this._state = AuthState.IDLE;
        this._token = null;
        this._isLoggedIn = false;
        this._currentRetry = 0;
        this._lastError = null;
        this._isProcessing = false;

        try {
            wx.removeStorageSync('token');
        } catch (e) { }

        this._emit('reset');
        console.log('[AuthManager] 已重置');
    }

    // =====================================================
    // 事件监听
    // =====================================================

    /**
     * 监听状态变化
     * @param {string} event - 事件名 ('stateChange', 'error', 'retry', 'reset')
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听的函数
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        // 返回取消监听的函数
        return () => this.off(event, callback);
    }

    /**
     * 取消监听
     */
    off(event, callback) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).delete(callback);
        }
    }

    /**
     * 监听一次
     */
    once(event, callback) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback(...args);
        };
        return this.on(event, wrapper);
    }

    // =====================================================
    // 私有方法：状态管理
    // =====================================================

    _setState(newState) {
        const oldState = this._state;
        if (oldState === newState) return;

        this._state = newState;
        this._stateHistory.push({
            from: oldState,
            to: newState,
            timestamp: Date.now(),
        });

        // 只保留最近 50 条记录
        if (this._stateHistory.length > 50) {
            this._stateHistory.shift();
        }

        console.log(`[AuthManager] 状态变化: ${oldState} -> ${newState}`);

        this._emit('stateChange', {
            oldState,
            newState,
            description: this.stateDescription,
        });
    }

    _setError(error) {
        this._lastError = error;
        this._setState(AuthState.ERROR);
        this._emit('error', error);
        console.error('[AuthManager] 错误:', error);
    }

    _emit(event, data) {
        if (this._listeners.has(event)) {
            this._listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error('[AuthManager] 事件回调错误:', e);
                }
            });
        }
    }

    // =====================================================
    // 私有方法：Token 处理
    // =====================================================

    async _checkToken() {
        this._setState(AuthState.TOKEN_CHECKING);
        try {
            // 1. 检查本地 token
            let currentToken = wx.getStorageSync('token');
            // 2. 如果没有 token，尝试刷新
            if (!currentToken || currentToken.trim() === '') {
                console.log('[AuthManager] 本地无 Token，尝试获取...');
                const refreshResult = await this._refreshToken();
                if (!refreshResult.success) {
                    return refreshResult;
                }
                currentToken = this._token;
            }
            // 3. 验证 token 有效性
            const isValid = await this._validateToken(currentToken);
            if (!isValid) {
                console.log('[AuthManager] Token 无效，尝试刷新...');
                const refreshResult = await this._refreshToken();
                if (!refreshResult.success) {
                    return refreshResult;
                }
                // 再次验证
                const isValidAfterRefresh = await this._validateToken(this._token);
                if (!isValidAfterRefresh) {
                    this._setState(AuthState.TOKEN_INVALID);
                    return { success: false, reason: 'token_still_invalid' };
                }
            } else {
                this._token = currentToken;
            }

            this._setState(AuthState.TOKEN_VALID);
            this._currentRetry = 0;
            return { success: true };

        } catch (error) {
            this._setError(error);
            return { success: false, error, retryable: true };
        }
    }

    async _refreshToken() {
        this._setState(AuthState.TOKEN_REFRESHING);

        return new Promise((resolve) => {
            wx.login({
                success: (loginRes) => {
                    if (!loginRes.code) {
                        resolve({ success: false, reason: 'wx_login_failed' });
                        return;
                    }

                    wx.request({
                        url: this._baseURL + API_URLS.getToken,
                        method: 'POST',
                        header: { 'Content-Type': 'application/json' },
                        data: { code: loginRes.code },
                        success: (response) => {
                            if (response.data?.data?.token) {
                                const token = response.data.data.token;
                                this._token = token;
                                wx.setStorageSync('token', token);
                                console.log('[AuthManager] Token 刷新成功');
                                resolve({ success: true });
                            } else {
                                resolve({ success: false, reason: 'invalid_response' });
                            }
                        },
                        fail: (error) => {
                            resolve({ success: false, error, retryable: true });
                        }
                    });
                },
                fail: (error) => {
                    resolve({ success: false, error, retryable: true });
                }
            });
        });
    }

    async _validateToken(token) {
        if (!token) return false;
        return new Promise((resolve) => {
            wx.request({
                url: this._baseURL + API_URLS.tokenActive,
                method: 'GET',
                header: {
                    'Content-Type': 'application/json',
                    'token': token
                },
                success: (response) => {
                    const isActive = response.data?.data === true;
                    resolve(isActive);
                },
                fail: () => {
                    resolve(false);
                }
            });
        });
    }

    // =====================================================
    // 私有方法：Session 处理
    // =====================================================

    async _checkSession() {
        this._setState(AuthState.SESSION_CHECKING);

        // 先确保有 token
        if (!this._token) {
            return {
                success: false,
                needTokenRefresh: true,
                reason: 'no_token'
            };
        }

        try {
            const sessionStatus = await this._getSessionStatus();

            // 检查是否因为 token 问题导致的失败
            if (sessionStatus.tokenExpired) {
                return {
                    success: false,
                    needTokenRefresh: true,
                    reason: 'token_expired'
                };
            }

            if (sessionStatus.isLoggedIn) {
                this._isLoggedIn = true;
                this._setState(AuthState.SESSION_VALID);
                return { success: true, isLoggedIn: true };
            } else {
                this._isLoggedIn = false;
                this._setState(AuthState.SESSION_EXPIRED);
                // Session 未登录不是错误，只是需要用户登录
                return {
                    success: true,
                    isLoggedIn: false,
                    retryable: false  // 不需要重试，需要用户登录
                };
            }

        } catch (error) {
            // 判断是否是 token 相关错误
            if (error.statusCode === 401 || error.tokenExpired) {
                return {
                    success: false,
                    needTokenRefresh: true,
                    reason: 'token_error'
                };
            }

            this._setError(error);
            return { success: false, error, retryable: true };
        }
    }

    async _getSessionStatus() {
        return new Promise((resolve, reject) => {
            wx.request({
                url: this._baseURL + API_URLS.sessionActive,
                method: 'GET',
                header: {
                    'Content-Type': 'application/json',
                    'token': this._token
                },
                success: (response) => {
                    // 检查是否 token 过期
                    if (response.statusCode === 401) {
                        resolve({ isLoggedIn: false, tokenExpired: true });
                        return;
                    }

                    resolve({
                        isLoggedIn: response.data?.isLogined === true,
                        tokenExpired: false
                    });
                },
                fail: (error) => {
                    reject(error);
                }
            });
        });
    }

    // =====================================================
    // 私有方法：重试机制
    // =====================================================

    _startRetry(step) {
        this._stopRetry();
        console.log(`[AuthManager] 开始重试机制，步骤: ${step}`);
        this._retryTimer = setInterval(async () => {
            this._currentRetry++;
            this._setState(AuthState.RETRYING);
            console.log(`[AuthManager] 第 ${this._currentRetry}/${this._maxRetries} 次重试...`);
            this._emit('retry', {
                current: this._currentRetry,
                max: this._maxRetries,
            });
            if (this._currentRetry >= this._maxRetries) {
                console.error('[AuthManager] 达到最大重试次数');
                this._stopRetry();
                this._emit('maxRetryReached', {
                    step,
                    retries: this._currentRetry,
                });
                return;
            }
            try {
                const result = await this.check(step, { autoRetry: false, force: true });
                if (result.success) {
                    console.log('[AuthManager] 重试成功');
                    this._stopRetry();
                }
            } catch (error) {
                console.error('[AuthManager] 重试出错:', error);
            }
        }, this._retryInterval);
    }

    _stopRetry() {
        if (this._retryTimer) {
            clearInterval(this._retryTimer);
            this._retryTimer = null;
            console.log('[AuthManager] 停止重试');
        }
    }
}

// =====================================================
// 导出单例
// =====================================================
export const authManager = new AuthManager();

// 也导出类本身（用于测试或特殊用途）
export { AuthManager };

// =====================================================
// 便捷 API 封装（保持与原有 authApi 兼容）
// =====================================================
export const authApi = {
    tokenValidate() {
        return http({
            url: API_URLS.tokenActive,
            method: 'GET'
        });
    },
    tokenRefresh() {
        return http({
            header: { 'Content-Type': 'application/json' },
            url: API_URLS.getToken,
            method: 'POST'
        });
    },
    sessionValidate() {
        return http({
            url: API_URLS.sessionActive,
            method: 'GET'
        });
    },
    sessionRefresh() {
        return http({
            url: API_URLS.sessionRefresh,
            method: 'POST'
        });
    },
    getPossibleUsrId() {
        return http({
            url: API_URLS.getPossibleUsrId,
            method: 'GET'
        });
    },
    getSms(data) {
        return http({
            url: API_URLS.getSms,
            data,
            method: 'POST'
        });
    },
    loginUsrPasswd(data) {
        return http({
            url: API_URLS.loginUsrPasswd,
            data,
            method: 'POST'
        });
    },
    loginSms(data) {
        return http({
            url: API_URLS.loginSms,
            data,
            method: 'POST'
        });
    },
    logout(data) {
        return http({
            url: API_URLS.logout,
            data,
            method: 'POST'
        });
    },
};