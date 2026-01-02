const app = getApp();

Page({
  // 修正：Page 配置项需要用对象键值对，不能用箭头函数的赋值写法
  loginSubmit(e) {
    // 1. 获取表单提交的参数（e.detail.value 是表单所有name对应的输入值）
    const { username, password } = e.detail.value;

    // 2. 简单的表单校验（非空校验）
    if (!username) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none'
      });
      return; // 校验不通过则终止执行
    }
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }

    // 3. 模拟登录请求（你可以替换成真实的接口请求）
    wx.showLoading({
      title: '登录中...'
    });

    // 示例：调用小程序云函数/后端接口（这里用setTimeout模拟异步请求）
    setTimeout(() => {
      wx.hideLoading();
      // 假设登录成功
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      // 登录成功后的操作：比如存储用户信息、跳转页面
      app.globalData.userInfo = { username }; // 存入全局变量
      wx.switchTab({
        url: '/pages/index/index' // 跳转到首页（根据你的页面路径调整）
      });

      // 如果登录失败，可修改为：
      // wx.showToast({
      //   title: '账号或密码错误',
      //   icon: 'none'
      // });
    }, 1000);
  }
});
