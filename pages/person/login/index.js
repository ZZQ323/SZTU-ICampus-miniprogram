// pages/person/login/index.js
import HttpClient from '../../../utils/core/HttpClient';
import { NavigationManager, NavigationContext } from '../../../utils/core/NavigationManager';
import CONSTANTS from "../../../utils/constant";
import SessionManager from '../../../utils/managers/SessionManager';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loginTypes: ["短信验证码登录"],
    chosenTabLabel: "短信验证码登录",
    chosenTab: 0,
    smsCountDown: 0,
    input: {
      usrId: '',
      SMS: {
        code: ''
      },
      PASSWORD: {
        code: ''
      }
    },
    isLoading:false
  },
  onTabsChange(event) {
    // console.log(`Change tab, tab-panel value is ${event.detail.value}.`);
    // console.log(event)
    this.setData({
      chosenTab: event.detail.value,
      chosenTabLabel: event.detail.label
    });
  },
  onTabsClick(event) {
    // console.log(`Click tab, tab-panel value is ${event.detail.value}.`);
    // console.log(event)
    this.setData({
      chosenTab: event.detail.value,
      chosenTabLabel: event.detail.label
    });
  },
  onStickyScroll(event) {
    // console.log(event.detail);
    this.setData({
      chosenTab: event.detail.value,
      chosenTabLabel: event.detail.label
    });
  },
  onInput(e) {
    const type = e.currentTarget.dataset.type;
    if (type.includes("SMS")) {
      if (type.includes("code")) this.setData({ 'input.SMS.code': e.detail.value });
      else this.setData({ 'input.usrId': e.detail.value });
    } else if (type.includes("PASSWORD")) {
      if (type.includes("code")) this.setData({ 'input.PASSWORD.code': e.detail.value });
      else this.setData({ 'input.usrId': e.detail.value });
    }
    console.log("e.currentTarget.dataset.type" + e.currentTarget.dataset.type);
  },
  async getSms(e) {
    let _data = this.data;
    if (_data.smsCountDown !== 0) return;
    this.setData({ smsCountDown: CONSTANTS.SMSDUR });
    this._timer = setInterval(() => {
      if (_data.smsCountDown === 0) {
        clearInterval(this._timer);
        return;
      }
      --_data.smsCountDown;
      this.setData({ smsCountDown: _data.smsCountDown });
    }, 1000)
    console.log("发送usrId" + _data.input.usrId);
    HttpClient.getInstance().post(
      '/auth/v1/request/sms',
      { userId: _data.input.usrId }
    ).then((resdata) => {
      // console.log(Object.keys(resdata.message));
      wx.showModal({ title: resdata.message, content: "验证码2分钟内有效，请及时登录！" })
    })

  },
  async onLogin() {
    // 防止重复点击
    if (this.data.isLoading) {
      console.log('[Login] 正在登录中，忽略重复点击');
      return;
    }
    // 验证输入
    if (!this.validateInput()) {
      return;
    }
    this.setData({ isLoading: true });
    wx.showLoading({ title: '登录中...' });
    try {
      // 执行登录
      let result = null;
      switch (this.data.chosenTabLabel) {
        case "短信验证码登录": {
          result = await this.SMSLogin();
          break;
        }
        case "账号密码登录": {
          result = await this.PASSWORDLogin();
          break;
        }
        default: {
          throw new Error('未知的登录方式');
        }
      }
      console.log('[Login] 登录结果:', result);
      // 检查登录是否成功
      if (result && result.success !== false) {
        // 保存用户信息到本地（如果后端返回了）
        if (result.data && result.data.userInfo) {
          wx.setStorageSync('userInfo', result.data.userInfo);
        }
        // 通知SessionManager登录成功
        SessionManager.getInstance().onLoginSuccess();
        wx.hideLoading();
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
        // 短暂延迟后返回原页面
        setTimeout(() => {
          NavigationManager.getInstance().navigateBack(this._context);
        }, 300);
      } else {
        throw new Error(result.message || '登录失败');
      }
    } catch (error) {
      console.error('[Login] 登录失败:', error);
      // 通知SessionManager登录失败
      SessionManager.getInstance().onLoginFailed(error);
      wx.hideLoading();
      // 显示错误信息
      wx.showModal({
        title: '登录失败',
        content: error.message || '请检查账号密码后重试',
        showCancel: false
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },
  async PASSWORDLogin() {
    // 实际的登录逻辑
    return await HttpClient.getInstance().post('/auth/v1/login', {
      userId: this.data.input.usrId,
      password: this.data.input.PASSWORD.code,
      loginType: this.data.chosenTabLabel
    });
  },
  async SMSLogin() {
    // 实际的登录逻辑
    return await HttpClient.getInstance().post('/auth/v1/login', {
      userId: this.data.input.usrId,
      smsCode: this.data.input.SMS.code,
      loginType: this.data.chosenTabLabel
    });
  },
  /**
  * 验证输入
  */
  validateInput() {
    const { usrId, SMS, PASSWORD } = this.data.input;
    if (!usrId || usrId.trim() === '') {
      wx.showToast({
        title: '请输入学号',
        icon: 'none'
      });
      return false;
    }
    if (this.data.chosenTabLabel === '短信验证码登录') {
      if (!SMS.code || SMS.code.trim() === '') {
        wx.showToast({
          title: '请输入验证码',
          icon: 'none'
        });
        return false;
      }
    } else if (this.data.chosenTabLabel === '账号密码登录') {
      if (!PASSWORD.code || PASSWORD.code.trim() === '') {
        wx.showToast({
          title: '请输入密码',
          icon: 'none'
        });
        return false;
      }
    }
    return true;
  },
  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    this._context = NavigationContext.fromQuery(options);
    // ensure login 
    wx.showLoading({ title: "正在获取登陆方式" });
    const _res = await HttpClient.getInstance().post('/auth/v1/cookie/refresh', {}, {
      autoNavigateToError: false,
      showToast: true
    });
    let loginTypes = _res.data.loginTypes; // 数组
    this.setData({ loginTypes });
    wx.hideLoading();

  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    this.setData({ chosenTab: 0 });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() { },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() { },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() { },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() { },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() { },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() { }
})