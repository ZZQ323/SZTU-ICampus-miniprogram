// pages/loading/index.js
Page({
  data: {
    statusText: '正在初始化...',
    isRetrying: false,
    retryCount: 0,
    maxRetries: 3,
  },
  onLoad() {
    // 监听状态变化
    this.unsubscribeState = authManager.on('stateChange', ({ description }) => {
      this.setData({ statusText: description });
    });
    // 监听重试
    this.unsubscribeRetry = authManager.on('retry', ({ current, max }) => {
      this.setData({
        isRetrying: true,
        retryCount: current,
        maxRetries: max,
      });
    });
  },
  onUnload() {
    // 页面卸载时取消监听
    this.unsubscribeState?.();
    this.unsubscribeRetry?.();
  },
  // 手动重试按钮
  onRetryTap() {
    authManager.retry(AuthStep.TOKEN);
  },
});