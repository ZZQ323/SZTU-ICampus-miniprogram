// sessionManager.js
import CONSTANT from "constant";
import { TokenManager, TokenState } from './tokenManager';

/**
 * Session 状态枚举
 */
export const SessionState = Object.freeze({
    IDLE: 'idle',               // 空闲，未开始
    WAITING_TOKEN: 'waiting_token', // 等待token就绪
    CHECKING: 'checking',       // 正在检查session有效性
    REFRESHING: 'refreshing',   // 正在刷新session
    READY: 'ready',             // session有效
    FAILED: 'failed',           // 失败（用于展示，会自动重试）
});

/**
 * Session 管理器
 * 
 * 核心特性：
 * 1. 依赖 TokenManager，确保先有有效token
 * 2. 保证调用 ensureSession 时 session 一定有效
 * 3. 无效时自动刷新，支持自动重试
 * 4. 在检查/刷新状态时配合loading页面显示
 * 5. 支持状态订阅
 * 
 * 注意：
 * - Session 保存在后端，通过 token 换取
 * - 只能请求刷新，不能返回 session 内容
 * - 有效性通过接口检测
 * 
 * 使用方式：
 * await SessionManager.getInstance().ensureSession();
 */
export class SessionManager {
    static _instance = null;

    static getInstance() {
        if (!SessionManager._instance) {
            SessionManager._instance = new SessionManager();
        }
        return SessionManager._instance;
    }

    constructor() {
        this._config = {
            baseURL: CONSTANT.baseURL,
            maxRetries: 3,
            retryDelay: 1000,
            cacheTime: 5 * 60 * 1000, // 5分钟内不重复检查
        };

        this._state = SessionState.IDLE;
        this._isValid = false;
        this._lastCheckTime = 0;

        // Token管理器
        this._tokenManager = TokenManager.getInstance();

        // 状态变化监听器
        this._listeners = new Set();

        // 等待队列
        this._pendingPromise = null;

        // 是否在loading页面中运行
        this._isInLoadingPage = false;
    }

    /**
     * 订阅状态变化
     * @param {Function} callback - 回调函数 (state, data) => void
     * @returns {Function} 取消订阅函数
     */
    subscribe(callback) {
        this._listeners.add(callback);
        callback(this._state, this._getStatusData());
        return () => this._listeners.delete(callback);
    }

    /**
     * 通知所有监听器状态变化
     */
    _notifyStateChange() {
        const data = this._getStatusData();
        this._listeners.forEach(cb => {
            try { cb(this._state, data); } catch (e) { console.error(e); }
        });
    }

    /**
     * 设置状态
     */
    _setState(state) {
        if (this._state !== state) {
            this._state = state;
            this._notifyStateChange();
        }
    }

    /**
     * 获取状态数据
     */
    _getStatusData() {
        return {
            state: this._state,
            isValid: this._isValid,
            tokenState: this._tokenManager.getState(),
        };
    }

    /**
     * 【主入口】确保 session 有效
     * 
     * 调用这个方法时：
     * - 先确保有有效的token
     * - 然后检查session是否有效
     * - 如果session无效，会自动刷新
     * - 保证返回时session一定是有效的
     * 
     * @returns {Promise<boolean>} 是否成功
     */
    async ensureSession() {
        // 如果session有效且在缓存时间内，直接返回
        if (this._state === SessionState.READY && this._isValid && this._isCacheValid()) {
            return true;
        }

        // 如果正在处理中，等待结果
        if (this._pendingPromise) {
            return this._pendingPromise;
        }

        // 开始新的session确保流程
        this._pendingPromise = this._doEnsureSession();

        try {
            return await this._pendingPromise;
        } finally {
            this._pendingPromise = null;
        }
    }

    /**
     * 执行session确保流程
     */
    async _doEnsureSession() {
        // 第一步：确保有有效token
        this._setState(SessionState.WAITING_TOKEN);

        let token;
        try {
            token = await this._tokenManager.ensureToken();
        } catch (error) {
            this._setState(SessionState.FAILED);
            throw new Error('获取Token失败: ' + error.message);
        }

        // 第二步：检查session有效性
        this._setState(SessionState.CHECKING);

        const isValid = await this._checkSession(token);
        if (isValid) {
            this._isValid = true;
            this._lastCheckTime = Date.now();
            this._setState(SessionState.READY);
            return true;
        }

        // Session无效，需要刷新
        // 如果已经在loading页面，直接执行刷新流程
        if (this._isInLoadingPage) {
            return this._refreshSessionWithRetry(token);
        }

        // 不在loading页面，需要跳转
        return this._redirectAndRefresh();
    }

    /**
     * 跳转到loading页面并等待刷新完成
     */
    _redirectAndRefresh() {
        return new Promise((resolve, reject) => {
            this._onSessionReady = resolve;
            this._onSessionFailed = reject;

            const pages = getCurrentPages();
            const currentPage = pages[pages.length - 1];
            const returnUrl = currentPage ? `/${currentPage.route}` : '/pages/index/index';

            wx.redirectTo({
                url: `/pages/person/loading/index?returnUrl=${encodeURIComponent(returnUrl)}`,
                fail: (err) => {
                    reject(new Error('跳转loading页面失败: ' + err.errMsg));
                }
            });
        });
    }

    /**
     * 【Loading页面调用】标记进入loading页面并开始刷新session
     * 需要在token获取完成后调用
     * @returns {Promise<boolean>} 是否成功
     */
    async startInLoadingPage() {
        this._isInLoadingPage = true;

        try {
            // 确保有token
            const token = await this._tokenManager.ensureToken();

            // 先检查session是否有效
            this._setState(SessionState.CHECKING);
            const isValid = await this._checkSession(token);

            if (isValid) {
                this._isValid = true;
                this._lastCheckTime = Date.now();
                this._setState(SessionState.READY);
                this._notifyWaiters(true);
                return true;
            }

            // 需要刷新
            const result = await this._refreshSessionWithRetry(token);
            this._notifyWaiters(result);
            return result;
        } catch (error) {
            this._notifyWaiters(false, error);
            throw error;
        } finally {
            this._isInLoadingPage = false;
        }
    }

    /**
     * 通知等待的调用者
     */
    _notifyWaiters(success, error = null) {
        if (success && this._onSessionReady) {
            this._onSessionReady(true);
        } else if (!success && this._onSessionFailed) {
            this._onSessionFailed(error || new Error('Session刷新失败'));
        }
        this._onSessionReady = null;
        this._onSessionFailed = null;
    }

    /**
     * 带重试的session刷新
     */
    async _refreshSessionWithRetry(token) {
        let lastError = null;

        for (let attempt = 1; attempt <= this._config.maxRetries; attempt++) {
            this._setState(SessionState.REFRESHING);

            try {
                const success = await this._refreshSession(token);
                if (success) {
                    this._isValid = true;
                    this._lastCheckTime = Date.now();
                    this._setState(SessionState.READY);
                    return true;
                }
                throw new Error('Session刷新返回失败');
            } catch (error) {
                lastError = error;
                console.error(`Session刷新失败 (尝试 ${attempt}/${this._config.maxRetries}):`, error);

                if (attempt < this._config.maxRetries) {
                    this._setState(SessionState.FAILED);
                    await this._delay(this._config.retryDelay * attempt);
                }
            }
        }

        this._isValid = false;
        this._setState(SessionState.FAILED);
        throw lastError || new Error('Session刷新失败');
    }

    /**
     * 检查session有效性
     */
    _checkSession(token) {
        return new Promise((resolve) => {
            wx.request({
                url: `${this._config.baseURL}/auth/v1/status/session`,
                method: 'GET',
                header: { 'token': token },
                success: (res) => {
                    // 根据接口返回判断session是否有效
                    resolve(res.statusCode === 200 && res.data?.valid === true);
                },
                fail: () => resolve(false)
            });
        });
    }

    /**
     * 刷新session
     */
    _refreshSession(token) {
        return new Promise((resolve) => {
            wx.request({
                url: `${this._config.baseURL}/auth/v1/cookie/refresh`,
                method: 'POST',
                header: {
                    'token': token,
                    'Content-Type': 'application/json'
                },
                success: (res) => {
                    resolve(res.statusCode === 200 && res.data?.success === true);
                },
                fail: () => resolve(false)
            });
        });
    }

    /**
     * 检查缓存是否有效
     */
    _isCacheValid() {
        return Date.now() - this._lastCheckTime < this._config.cacheTime;
    }

    /**
     * 强制重新检查session
     * 用于业务方检测到session失效时调用
     */
    async revalidate() {
        this._lastCheckTime = 0;
        this._isValid = false;
        this._setState(SessionState.IDLE);
        return this.ensureSession();
    }

    /**
     * 清除session状态（登出时使用）
     */
    clearSession() {
        this._isValid = false;
        this._lastCheckTime = 0;
        this._setState(SessionState.IDLE);
    }

    /**
     * 获取当前状态
     */
    getState() {
        return this._state;
    }

    /**
     * 检查session是否有效（仅返回缓存状态，不发起请求）
     */
    isSessionValid() {
        return this._isValid && this._isCacheValid();
    }

    // ===== 私有辅助方法 =====

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default SessionManager;