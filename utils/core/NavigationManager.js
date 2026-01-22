/**
 * 页面跳转管理器
 * 
 * 负责：
 * 1. 统一管理loading/error页面的跳转
 * 2. 保存和恢复跳转上下文
 * 3. 确保能正确返回原页面
 * 
 * 跳转策略：
 * - 业务页面 -> Loading: navigateTo
 * - Loading -> Error: redirectTo
 * - Error/Loading -> 原页面: navigateBack或reLaunch
 */

export class NavigationContext {
  constructor(options = {}) {
    this.returnUrl = options.returnUrl || '';      // 返回的URL
    this.returnQuery = options.returnQuery || {};  // 返回的查询参数
    this.manager = options.manager || '';          // 哪个管理器触发的
    this.action = options.action || '';            // 执行的动作
    this.timestamp = Date.now();                   // 时间戳
    this.fromPage = options.fromPage || '';        // 来源页面类型（business/loading/error）
  }

  /**
   * 编码为URL查询字符串
   */
  toQueryString() {
    const data = {
      returnUrl: this.returnUrl,
      manager: this.manager,
      action: this.action,
      fromPage: this.fromPage,
      timestamp: this.timestamp
    };
    
    // 添加returnQuery
    if (Object.keys(this.returnQuery).length > 0) {
      data.returnQuery = JSON.stringify(this.returnQuery);
    }

    return Object.entries(data)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * 从URL查询参数解析
   */
  static fromQuery(query) {
    const context = new NavigationContext({
      returnUrl: query.returnUrl || '',
      manager: query.manager || '',
      action: query.action || '',
      fromPage: query.fromPage || 'business',
      timestamp: parseInt(query.timestamp) || Date.now()
    });

    // 解析returnQuery
    if (query.returnQuery) {
      try {
        context.returnQuery = JSON.parse(decodeURIComponent(query.returnQuery));
      } catch (e) {
        console.error('解析returnQuery失败:', e);
      }
    }

    return context;
  }

  /**
   * 构建完整的返回URL（带查询参数）
   */
  buildFullReturnUrl() {
    if (!this.returnUrl) return '';
    
    const queryString = Object.entries(this.returnQuery)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    return queryString ? `${this.returnUrl}?${queryString}` : this.returnUrl;
  }
}

/**
 * 页面跳转管理器（单例）
 */
export class NavigationManager {
  static _instance = null;

  static getInstance() {
    if (!NavigationManager._instance) {
      NavigationManager._instance = new NavigationManager();
    }
    return NavigationManager._instance;
  }

  constructor() {
    this._config = {
      loadingPageUrl: '/pages/common/loading/index',
      errorPageUrl: '/pages/common/error/index',
      homePageUrl: '/pages/home/index',
      enableLogging: true
    };

    // 当前上下文
    this._currentContext = null;
  }

  /**
   * 配置管理器
   */
  config(options) {
    Object.assign(this._config, options);
  }

  /**
   * 保存跳转上下文
   * @param {Object} options 上下文选项
   * @returns {NavigationContext}
   */
  saveContext(options = {}) {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    
    // 获取当前页面的完整路由和参数
    let returnUrl = options.returnUrl;
    let returnQuery = options.returnQuery || {};

    if (!returnUrl && currentPage) {
      returnUrl = `/${currentPage.route}`;
      returnQuery = currentPage.options || {};
    }

    if (!returnUrl) {
      returnUrl = this._config.homePageUrl;
    }

    const context = new NavigationContext({
      ...options,
      returnUrl,
      returnQuery,
      fromPage: this._detectPageType(currentPage)
    });

    this._currentContext = context;
    this._log('保存上下文:', context);
    return context;
  }

  /**
   * 获取当前上下文
   */
  getCurrentContext() {
    return this._currentContext;
  }

  /**
   * 跳转到Loading页面
   */
  navigateToLoading(context) {
    if (!context) {
      context = this.saveContext();
    }

    const url = `${this._config.loadingPageUrl}?${context.toQueryString()}`;
    
    this._log('跳转到Loading页面:', url);
    
    wx.navigateTo({
      url,
      fail: (err) => {
        console.error('跳转Loading页面失败:', err);
        // 如果navigateTo失败（可能是页面栈满了），使用redirectTo
        wx.redirectTo({ url });
      }
    });
  }

  /**
   * 跳转到Error页面
   * 
   * 从Loading页面跳转到Error页面使用redirectTo
   * 这样Error页面重试成功后navigateBack一次就能回到原业务页面
   */
  navigateToError(context, errorInfo = {}) {
    if (!context) {
      context = this._currentContext || this.saveContext();
    }

    // 更新fromPage为loading（因为是从loading跳转过来的）
    context.fromPage = 'loading';

    const url = `${this._config.errorPageUrl}?${context.toQueryString()}&errorMessage=${encodeURIComponent(errorInfo.message || '操作失败')}`;
    
    this._log('跳转到Error页面:', url);
    
    wx.redirectTo({
      url,
      fail: (err) => {
        console.error('跳转Error页面失败:', err);
        wx.showToast({
          title: errorInfo.message || '操作失败',
          icon: 'none'
        });
      }
    });
  }

  /**
   * 从Loading/Error页面返回
   * 
   * 策略：
   * 1. 如果 fromPage 是business，使用navigateBack(1)
   * 2. 如果fromPage是loading（error页面的情况），使用navigateBack(1)，因为已经redirectTo了
   * 3. 如果navigateBack失败，使用reLaunch到returnUrl
   */
  navigateBack(context, delta = 1) {
    if (!context) {
      context = this._currentContext;
    }

    if (!context) {
      this._log('没有上下文，返回首页');
      wx.reLaunch({ url: this._config.homePageUrl });
      return;
    }

    this._log('返回原页面:', context);

    // 尝试navigateBack
    const pages = getCurrentPages();
    this._log('当前页面栈深度:', pages.length);

    if (pages.length > delta) {
      wx.navigateBack({
        delta,
        success: () => {
          this._log('navigateBack成功');
          this._currentContext = null;
        },
        fail: (err) => {
          this._log('navigateBack失败，使用reLaunch:', err);
          this._fallbackToReLaunch(context);
        }
      });
    } else {
      // 页面栈不够深，直接reLaunch
      this._fallbackToReLaunch(context);
    }
  }

  /**
   * 后备方案：使用reLaunch
   * @private
   */
  _fallbackToReLaunch(context) {
    const fullUrl = context.buildFullReturnUrl();
    
    if (!fullUrl) {
      wx.reLaunch({ url: this._config.homePageUrl });
      return;
    }

    wx.reLaunch({
      url: fullUrl,
      success: () => {
        this._log('reLaunch成功');
        this._currentContext = null;
      },
      fail: (err) => {
        this._log('reLaunch失败，尝试switchTab:', err);
        // 最后尝试switchTab（如果是tabBar页面）
        wx.switchTab({
          url: fullUrl,
          fail: () => {
            // 全都失败了，回到首页
            wx.reLaunch({ url: this._config.homePageUrl });
          }
        });
      }
    });
  }

  /**
   * 检测页面类型
   * @private
   */
  _detectPageType(page) {
    if (!page) return 'business';
    
    const route = page.route || '';
    
    if (route.includes('/loading/')) return 'loading';
    if (route.includes('/error/')) return 'error';
    
    return 'business';
  }

  /**
   * 日志输出
   * @private
   */
  _log(...args) {
    if (this._config.enableLogging) {
      console.log('[NavigationManager]', ...args);
    }
  }
}

export default NavigationManager;
