// pages/common/error/index.js

import TokenManager from '../../../utils/managers/TokenManager';
import SessionManager from '../../../utils/managers/SessionManager';
import NavigationManager, { NavigationContext } from '../../../utils/core/NavigationManager';

/**
 * Error页面
 * 
 * 功能：
 * 1. 展示错误信息
 * 2. 提供重试按钮
 * 3. 显示重试进度
 * 4. 重试成功后返回原页面
 */

Page({
  data: {
    // 错误信息
    errorMessage: '操作失败，请重试',
    
    // 错误详情（可选）
    errorDetail: '',
    
    // 是否正在重试
    isRetrying: false,
    
    // 重试次数
    retryCount: 0,
    
    // 最大重试次数
    maxRetries: 3,
    
    // 重试状态文本
    retryStatusText: '',
    
    // 是否显示详情
    showDetail: false
  },

  // 页面实例变量
  _context: null,
  _tokenManager: null,
  _sessionManager: null,
  _navigationManager: null,
  _currentManager: null,

  /**
   * 页面加载
   */
  onLoad(options) {
    console.log('[Error] 页面加载, options:', options);

    // 解析导航上下文
    this._context = NavigationContext.fromQuery(options);
    console.log('[Error] 导航上下文:', this._context);

    // 解析错误信息
    const errorMessage = options.errorMessage 
      ? decodeURIComponent(options.errorMessage)
      : '操作失败，请重试';

    this.setData({ errorMessage });

    // 获取管理器实例
    this._tokenManager = TokenManager.getInstance();
    this._sessionManager = SessionManager.getInstance();
    this._navigationManager = NavigationManager.getInstance();

    // 根据context确定是哪个管理器的错误
    this._currentManager = this._context.manager;

    // 获取详细错误信息（如果有）
    this._loadErrorDetail();
  },

  /**
   * 加载错误详情
   */
  _loadErrorDetail() {
    let errorDetail = '';
    const manager = this._getManager();
    
    if (manager) {
      const lastError = manager.getLastError();
      if (lastError) {
        errorDetail = lastError.message || lastError.toString();
      }
    }

    if (errorDetail && errorDetail !== this.data.errorMessage) {
      this.setData({ errorDetail });
    }
  },

  /**
   * 获取当前管理器实例
   */
  _getManager() {
    if (this._currentManager === 'TokenManager') {
      return this._tokenManager;
    } else if (this._currentManager === 'SessionManager') {
      return this._sessionManager;
    }
    return null;
  },

  /**
   * 重试按钮点击
   */
  async onRetry() {
    console.log('[Error] 开始重试');

    if (this.data.isRetrying) {
      console.log('[Error] 正在重试中，忽略');
      return;
    }

    this.setData({ 
      isRetrying: true,
      retryCount: this.data.retryCount + 1,
      retryStatusText: '正在重试...'
    });

    try {
      const manager = this._getManager();
      
      if (!manager) {
        throw new Error('未找到对应的管理器');
      }

      // 调用管理器的retryOnce方法
      console.log('[Error] 调用管理器重试:', this._currentManager);
      const result = await manager.retryOnce();

      if (result.success) {
        console.log('[Error] 重试成功');
        this.setData({ retryStatusText: '重试成功！' });

        // 短暂延迟后返回
        setTimeout(() => {
          this._navigateBack();
        }, 500);

      } else {
        throw result.error || new Error('重试失败');
      }

    } catch (error) {
      console.error('[Error] 重试失败:', error);
      
      this.setData({ 
        isRetrying: false,
        retryStatusText: `重试失败: ${error.message}`,
        errorMessage: error.message || '重试失败，请稍后再试'
      });

      // 显示toast
      wx.showToast({
        title: '重试失败',
        icon: 'none',
        duration: 2000
      });

      // 如果达到最大重试次数，提示用户
      if (this.data.retryCount >= this.data.maxRetries) {
        wx.showModal({
          title: '重试失败',
          content: '已达到最大重试次数，请检查网络连接或稍后再试',
          showCancel: false
        });
      }
    }
  },

  /**
   * 返回按钮点击
   */
  onGoBack() {
    console.log('[Error] 返回原页面（不重试）');
    this._navigateBack();
  },

  /**
   * 返回原页面
   */
  _navigateBack() {
    console.log('[Error] 返回原页面');
    this._navigationManager.navigateBack(this._context);
  },

  /**
   * 切换显示详情
   */
  onToggleDetail() {
    this.setData({
      showDetail: !this.data.showDetail
    });
  },

  /**
   * 复制错误信息
   */
  onCopyError() {
    const text = `错误信息: ${this.data.errorMessage}\n详细: ${this.data.errorDetail}`;
    
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  }
});
