
export function rememberChangeHandler(e) {
  // 恢复原有onRememberChange逻辑（原生checkbox触发）
  // 原生checkbox的e.detail.value是数组，有值则选中

  // console.log("onRememberChangeHandler: " + e.detail);
  // console.log("onRememberChangeHandler: " + arguments);
  // console.log(this); undefined
  // console.log(globalThis); window

  this.setData({
    remember: e.detail.value.length > 0
  });
  console.log(this.data);
}

// 双输入登录表单 验证码or密码

export function studentIdInputHandler(e) {
  const value = e.detail.value;
  this.setData({
    code: value,
    errorMsg: ''  // 清空错误信息
  });
}

export function codeInputHandler(e) {
  const value = e.detail.value;
  this.setData({
    code: value,
    errorMsg: ''  // 清空错误信息
  });
}

// === 焦点处理 ===
export function focusHandler(e) {
  const field = e.currentTarget.dataset.field;
  this.setData({ focusField: field });
}

export function blurHandler() {
  this.setData({ focusField: '' });
}

export function postApp(e,apiStr,preDo,PostDo) {
  // 原有登录逻辑不变
  preDo();

  

  // ===== 新增：POST请求登录接口 =====
  // 1. 显示加载中提示
  wx.showLoading({
    title: '登录中...',
    mask: true
  });

  // 2. 发送POST请求
  wx.request({
    url: baseURL+apiStr, // 接口地址
    method: 'POST', // 请求方式
    header: {
      'Content-Type': 'application/json'
    },
    data: {
      userId: studentId, // 学号参数
      password: password // 密码参数
      // 如果需要传remember，可追加：remember: remember
    },
    // 请求成功回调
    success: (res) => {
      console.log('登录接口返回：', res.data); // 打印返回数据，方便调试

      // 根据后端返回结果处理（示例：假设后端返回code=200表示成功）
      if (res.statusCode === 200 && res.data.code === 200) {
        // 登录成功：提示+跳转首页（根据你的业务调整）
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });
        // 延时跳转（可选）
        setTimeout(() => {
          // 跳转到首页（替换为你的首页路径）
          wx.switchTab({
            url: '/pages/index/index'
          });
          // 如果不是tab页，用：wx.navigateTo({ url: '/pages/index/index' });
        }, 1500);
      } else {
        // 登录失败：显示后端返回的错误信息
        wx.showToast({
          title: res.data.msg || '登录失败，请检查账号密码',
          icon: 'none',
          duration: 2000
        });
      }
    },
    // 请求失败回调（网络错误、接口不可达等）
    fail: (err) => {
      console.error('登录请求失败：', err);
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    },
    // 无论成功失败，都隐藏加载提示
    complete: () => {
      wx.hideLoading();
    }
  });
}

export function forgotPassword() {
  wx.showModal({
    title: '忘记密码',
    content: '忘记密码功能将跳转到密码找回页面',
    showCancel: false
  });
}