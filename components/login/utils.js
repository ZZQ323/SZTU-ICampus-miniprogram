export const loginUrl = "/usr/login";
export const smsUrl = "/usr/sms";


export function rememberChangeHandler(e) 
{
  console.log(this);
  this.triggerEvent('updateRememberAcc', { rememberAcc: e.detail.value.length > 0 });
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

export function blurHandler() { this.setData({ focusField: '' }); }

export function postApp(e, apiStr, preDo, PostDo) {
  // 原有登录逻辑不变
  preDo();

  // ===== 新增：POST请求登录接口 =====
  
}

export function forgotPassword() {
  wx.showModal({
    title: '忘记密码',
    content: '忘记密码功能将跳转到密码找回页面',
    showCancel: false
  });
}



