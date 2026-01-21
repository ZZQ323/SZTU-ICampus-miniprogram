/**
 * HTTP客户端
 * 
 * 功能：
 * 1. 封装wx.request，统一处理请求和响应
 * 2. 自动添加token
 * 3. 统一错误处理
 * 4. 支持重试机制
 * 5. 可配置的错误处理策略
 */

import NavigationManager from './NavigationManager';

/**
 * HTTP响应包装类
 */
export class HttpResponse {
  constructor(success, data, error, statusCode) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.statusCode = statusCode;
  }

  static success(data, statusCode = 200) {
    return new HttpResponse(true, data, null, statusCode);
  }

  static error(error, statusCode = 0) {
    return new HttpResponse(false, null, error, statusCode);
  }
}

/**
 * HTTP错误类
 */
export class HttpError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * HTTP请求配置
 */
export class HttpRequestConfig {
  constructor(options = {}) {
    this.api = options.api || options.url || '';
    this.data = options.data || {};
    this.method = options.method || 'POST';
    this.header = options.header || {};
    this.dataType = options.dataType || 'json';
    this.responseType = options.responseType || 'text';
    this.timeout = options.timeout || 30000;
    
    // 错误处理配置
    this.errorHandling = {
      autoNavigateToError: options.autoNavigateToError !== false, // 是否自动跳转error页面
      showToast: options.showToast !== false,                     // 是否显示toast
      maxRetries: options.maxRetries || 0,                        // 最大重试次数
      retryDelay: options.retryDelay || 1000,                     // 重试延迟
      ...(options.errorHandling || {})
    };

    // token配置
    this.tokenConfig = {
      autoAddToken: options.autoAddToken !== false,               // 是否自动添加token
      tokenKey: options.tokenKey || 'token',                      // token的header key
      getToken: options.getToken || null,                         // 获取token的函数
      ...(options.tokenConfig || {})
    };
  }
}

/**
 * HTTP客户端类（单例）
 */
export class HttpClient {
  static _instance = null;

  static getInstance() {
    if (!HttpClient._instance) {
      HttpClient._instance = new HttpClient();
    }
    return HttpClient._instance;
  }

  constructor() {
    this._config = {
      baseURL: '',
      timeout: 30000,
      enableLogging: true
    };

    this._navigationManager = NavigationManager.getInstance();
    this._tokenGetter = null;
  }

  /**
   * 配置HTTP客户端
   */
  config(options) {
    Object.assign(this._config, options);
    
    if (options.getToken) {
      this._tokenGetter = options.getToken;
    }
  }

  /**
   * 设置获取token的函数
   */
  setTokenGetter(getter) {
    this._tokenGetter = getter;
  }

  /**
   * 发起HTTP请求
   * @param {HttpRequestConfig|Object} config 请求配置
   * @returns {Promise<any>}
   */
  async request(config) {
    // 规范化配置
    if (!(config instanceof HttpRequestConfig)) {
      config = new HttpRequestConfig(config);
    }

    this._log('发起请求:', config.api);

    // 自动添加token
    if (config.tokenConfig.autoAddToken) {
      await this._addToken(config);
    }

    // 带重试的请求
    let lastError = null;
    const maxAttempts = config.errorHandling.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this._log(`请求尝试 ${attempt}/${maxAttempts}:`, config.api);
        return await this._doRequest(config);

      } catch (error) {
        lastError = error;
        this._log(`请求失败 (${attempt}/${maxAttempts}):`, error.message);

        if (attempt < maxAttempts) {
          await this._delay(config.errorHandling.retryDelay * attempt);
        }
      }
    }

    // 所有重试都失败了，处理错误
    return this._handleError(lastError, config);
  }

  /**
   * 执行单次请求
   * @private
   */
  _doRequest(config) {
    return new Promise((resolve, reject) => {
      const requestConfig = {
        url: this._buildUrl(config.api),
        data: config.data,
        method: config.method,
        header: this._buildHeaders(config.header),
        dataType: config.dataType,
        responseType: config.responseType,
        timeout: config.timeout || this._config.timeout,

        success: (res) => {
          this._log('请求成功:', res);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new HttpError(
              res.data?.message || `请求失败: ${res.statusCode}`,
              res.statusCode,
              res
            ));
          }
        },

        fail: (err) => {
          this._log('请求失败:', err);
          reject(new HttpError(
            err.errMsg || '网络请求失败',
            0,
            null
          ));
        }
      };

      wx.request(requestConfig);
    });
  }

  /**
   * 处理错误
   * @private
   */
  async _handleError(error, config) {
    this._log('处理错误:', error);

    // 显示Toast
    if (config.errorHandling.showToast) {
      wx.showToast({
        title: error.message || '请求失败',
        icon: 'none',
        duration: 2000
      });
    }

    // 自动跳转到error页面
    if (config.errorHandling.autoNavigateToError) {
      const context = this._navigationManager.saveContext({
        manager: 'HttpClient',
        action: 'request'
      });

      this._navigationManager.navigateToError(context, {
        message: error.message,
        statusCode: error.statusCode
      });
    }

    throw error;
  }

  /**
   * 添加token到请求头
   * @private
   */
  async _addToken(config) {
    let token = null;

    // 使用配置中指定的获取函数
    if (config.tokenConfig.getToken) {
      token = await config.tokenConfig.getToken();
    }
    // 使用全局配置的获取函数
    else if (this._tokenGetter) {
      token = await this._tokenGetter();
    }

    if (token) {
      config.header[config.tokenConfig.tokenKey] = token;
    }
  }

  /**
   * 构建完整URL
   * @private
   */
  _buildUrl(api) {
    if (api.startsWith('http://') || api.startsWith('https://')) {
      return api;
    }
    return this._config.baseURL + api;
  }

  /**
   * 构建请求头
   * @private
   */
  _buildHeaders(customHeaders) {
    return {
      'Content-Type': 'application/json',
      ...customHeaders
    };
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
      console.log('[HttpClient]', ...args);
    }
  }

  // ==================== 快捷方法 ====================

  get(api, config = {}) {
    return this.request({ ...config, api, method: 'GET' });
  }

  post(api, data, config = {}) {
    return this.request({ ...config, api, data, method: 'POST' });
  }

  put(api, data, config = {}) {
    return this.request({ ...config, api, data, method: 'PUT' });
  }

  delete(api, config = {}) {
    return this.request({ ...config, api, method: 'DELETE' });
  }
}

// 导出单例和工厂函数
export default HttpClient;

/**
 * 创建HTTP请求（使用单例）
 */
export function http(config) {
  return HttpClient.getInstance().request(config);
}
