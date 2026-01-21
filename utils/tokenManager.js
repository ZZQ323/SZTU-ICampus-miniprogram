// tokenManager.js
import CONSTANT from "constant";

/**
 * Token 状态枚举
 */
export const TokenState = Object.freeze({
    IDLE: 'idle',           // 空闲，未开始
    CHECKING: 'checking',   // 正在检查token有效性
    FETCHING: 'fetching',   // 正在获取新token
    READY: 'ready',         // token有效，可用
    FAILED: 'failed',       // 失败（用于展示，会自动重试）
});

/**
 * Token 管理器
 * 
 * 核心特性：
 * 1. 保证获取时拿到的token一定是有效的
 * 2. 无效或没有时自动重试直到成功
 * 3. 在检查/获取状态时自动跳转到loading页面
 * 4. 支持状态订阅，loading页面可以实时显示进度
 * 
 * 使用方式：
 * const token = await TokenManager.getInstance().ensureToken();
 */
export class TokenManager {
    static _instance = null;

    static getInstance() {
        if (!TokenManager._instance) {
            TokenManager._instance = new TokenManager();
        }
        return TokenManager._instance;
    }

    constructor() {
        this._config = {
            baseURL: CONSTANT.baseURL,
            storageKey: 'auth_token',
            maxRetries: 3,
            retryDelay: 1000,
        };

        this._state = TokenState.IDLE;
        this._token = null;
        this._lastValidateTime = 0;
        this._validateCacheTime = 5 * 60 * 1000; // 5分钟内不重复验证

        // 状态变化监听器
        this._listeners = new Set();

        // 等待队列：当正在处理时，后续请求加入队列
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
        // 立即通知当前状态
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
            hasToken: !!this._token,
            tokenPreview: this._token ? '****' + this._token.slice(-4) : null,
        };
    }

    /**
     * 【主入口】确保有有效的 token
     * 
     * 调用这个方法时：
     * - 如果token有效，直接返回
     * - 如果token无效或不存在，会自动跳转到loading页面进行获取
     * - 保证返回的token一定是有效的
     * 
     * @returns {Promise<string>} 有效的token
     */
    async ensureToken() {
        // 如果已有有效token且在缓存时间内，直接返回
        if (this._state === TokenState.READY && this._token && this._isValidateCacheValid()) {
            return this._token;
        }

        // 如果正在处理中，等待结果
        if (this._pendingPromise) {
            return this._pendingPromise;
        }

        // 开始新的token获取流程
        this._pendingPromise = this._doEnsureToken();

        try {
            const token = await this._pendingPromise;
            return token;
        } finally {
            this._pendingPromise = null;
        }
    }

    /**
     * 执行token确保流程
     */
    async _doEnsureToken() {
        // 第一步：检查本地存储的token
        this._setState(TokenState.CHECKING);

        const storedToken = this._getStoredToken();
        if (storedToken) {
            // 验证token有效性
            const isValid = await this._validateToken(storedToken);
            if (isValid) {
                this._token = storedToken;
                this._lastValidateTime = Date.now();
                this._setState(TokenState.READY);
                return storedToken;
            }
        }

        // Token无效或不存在，需要跳转到loading页面获取
        // 如果已经在loading页面，直接执行获取流程
        if (this._isInLoadingPage) {
            return this._fetchTokenWithRetry();
        }

        // 不在loading页面，需要跳转
        return this._redirectAndFetch();
    }

    /**
     * 跳转到loading页面并等待获取完成
     */
    _redirectAndFetch() {
        return new Promise((resolve, reject) => {
            // 保存回调
            this._onTokenReady = resolve;
            this._onTokenFailed = reject;

            // 获取当前页面路径
            const pages = getCurrentPages();
            const currentPage = pages[pages.length - 1];
            const returnUrl = currentPage ? `/${currentPage.route}` : '/pages/index/index';

            // 跳转到loading页面
            wx.redirectTo({
                url: `/pages/person/loading/index?returnUrl=${encodeURIComponent(returnUrl)}`,
                fail: (err) => {
                    reject(new Error('跳转loading页面失败: ' + err.errMsg));
                }
            });
        });
    }

    /**
     * 【Loading页面调用】标记进入loading页面并开始获取token
     * @returns {Promise<string>} token
     */
    async startInLoadingPage() {
        this._isInLoadingPage = true;

        try {
            const token = await this._fetchTokenWithRetry();

            // 通知等待的调用者
            if (this._onTokenReady) {
                this._onTokenReady(token);
                this._onTokenReady = null;
                this._onTokenFailed = null;
            }

            return token;
        } catch (error) {
            if (this._onTokenFailed) {
                this._onTokenFailed(error);
                this._onTokenReady = null;
                this._onTokenFailed = null;
            }
            throw error;
        } finally {
            this._isInLoadingPage = false;
        }
    }

    /**
     * 带重试的token获取
     */
    async _fetchTokenWithRetry() {
        let lastError = null;

        for (let attempt = 1; attempt <= this._config.maxRetries; attempt++) {
            this._setState(TokenState.FETCHING);

            try {
                const token = await this._fetchToken();
                this._token = token;
                this._setStoredToken(token);
                this._lastValidateTime = Date.now();
                this._setState(TokenState.READY);
                return token;
            } catch (error) {
                lastError = error;
                console.error(`Token获取失败 (尝试 ${attempt}/${this._config.maxRetries}):`, error);

                if (attempt < this._config.maxRetries) {
                    this._setState(TokenState.FAILED);
                    await this._delay(this._config.retryDelay * attempt);
                }
            }
        }

        this._setState(TokenState.FAILED);
        throw lastError || new Error('Token获取失败');
    }

    /**
     * 获取token（单次请求）
     */
    _fetchToken() {
        return new Promise((resolve, reject) => {
            wx.login({
                success: (loginRes) => {
                    if (!loginRes.code) {
                        reject(new Error('wx.login失败，未获取到code'));
                        return;
                    }

                    wx.request({
                        url: `${this._config.baseURL}/wx-auth/v1/get-token`,
                        method: 'POST',
                        header: { 'Content-Type': 'application/json' },
                        data: { code: loginRes.code },
                        success: (res) => {
                            if (res.statusCode === 200 && res.data?.data?.token) {
                                resolve(res.data.data.token);
                            } else {
                                reject(new Error(res.data?.message || 'Token获取失败'));
                            }
                        },
                        fail: (err) => reject(new Error('网络请求失败: ' + err.errMsg))
                    });
                },
                fail: (err) => reject(new Error('wx.login失败: ' + err.errMsg))
            });
        });
    }

    /**
     * 验证token有效性
     */
    _validateToken(token) {
        return new Promise((resolve) => {
            wx.request({
                url: `${this._config.baseURL}/wx-auth/v1/active`,
                method: 'GET',
                header: { 'token': token },
                success: (res) => resolve(res.statusCode === 200),
                fail: () => resolve(false)
            });
        });
    }

    /**
     * 检查验证缓存是否有效
     */
    _isValidateCacheValid() {
        return Date.now() - this._lastValidateTime < this._validateCacheTime;
    }

    /**
     * 强制重新验证token
     * 用于业务方检测到token失效时调用
     */
    async revalidate() {
        this._lastValidateTime = 0; // 清除缓存
        this._token = null;
        this._setState(TokenState.IDLE);
        return this.ensureToken();
    }

    /**
     * 清除token（登出时使用）
     */
    clearToken() {
        this._token = null;
        this._lastValidateTime = 0;
        this._setState(TokenState.IDLE);
        try {
            wx.removeStorageSync(this._config.storageKey);
        } catch (e) { }
    }

    /**
     * 获取当前状态
     */
    getState() {
        return this._state;
    }

    /**
     * 获取当前token（可能为null，不保证有效性）
     * 如需保证有效性，请使用 ensureToken()
     */
    getCurrentToken() {
        return this._token;
    }

    // ===== 私有辅助方法 =====

    _getStoredToken() {
        try {
            return wx.getStorageSync(this._config.storageKey) || null;
        } catch (e) {
            return null;
        }
    }

    _setStoredToken(token) {
        try {
            wx.setStorageSync(this._config.storageKey, token);
        } catch (e) {
            console.error('存储token失败:', e);
        }
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default TokenManager;