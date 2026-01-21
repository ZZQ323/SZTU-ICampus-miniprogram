// pages/person/login/index.js
import HttpClient from '../../utils/core/HttpClient';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loginTypes: ["短信验证码登录"],
    chosenTab: 0,
    smsCountDown: 0,
    input: {
      usrId,
      SMS: {
        code: ''
      },
      PASSWORD: {
        code: ''
      }
    }
  },
  onTabsChange(event) {
    console.log(`Change tab, tab-panel value is ${event.detail.value}.`);
    this.setData({ chosenTab: event.detail.value });
  },
  onTabsClick(event) {
    console.log(`Click tab, tab-panel value is ${event.detail.value}.`);
    this.setData({ chosenTab: event.detail.value });
  },
  onStickyScroll(event) {
    console.log(event.detail);
    this.setData({ chosenTab: event.detail.value });
  },
  onInput(e){
    const type = e.detail.dataset.type;
    if( type.contains("SMS") ){
      if(type.contains("code"))this.setData({'input.SMS.code':e.detail.value});
      this.setData({'input.usrId':e.detail.value});
    }else if( type.contains("PASSWORD") ){
      if(type.contains("code"))this.setData({'input.PASSWORD.code':e.detail.value});
      this.setData({'input.usrId':e.detail.value});
    }
  },
  async getSms(e) {
    let _data = this.data;
    if (_data.smsCountDown !== 0) return;
    this.setData({ smsCountDown: CONSTANTS.SMSDUR });
    HttpClient.getInstance().post(
      '/auth/v1/request/sms',
      { userId: _data.input.usrId }
    ).then(res => {
      wx.showModal({ title: res.data.message, content: "验证码2分钟内有效，请及时登录！" });
    });
  },
  async onLogin() {
    try {
      // 执行登录
      const result = await this.doLogin();
      if (result.success) {
        // 通知SessionManager
        SessionManager.getInstance().onLoginSuccess();
        // 返回原页面
        NavigationManager.getInstance().navigateBack(this._context);
      }
    } catch (error) {
      SessionManager.getInstance().onLoginFailed(error);
    }
  },
  async doLogin() {
    // 实际的登录逻辑
    return await HttpClient.getInstance().post('/auth/v1/login/sms', {
      username: this.data.input.usrId,
      password: this.data.input.SMS.code
    });
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this._context = NavigationContext.fromQuery(options);
    const _res = HttpClient.getInstance().get('/auth/v1/history');
    let loginTypes  = _res.data.loginTypes; // 数组
    this.setData({loginTypes});
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {}
})