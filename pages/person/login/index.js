// pages/person/login/index.js
import CONSTANTS from "../../../utils/constant";
import http from "../../../api/http";
import { TokenManager, TokenState } from "../../../utils/tokenManager.js";

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loginTypes: ["短信验证登录", "账号密码"],
    chosenTab: 0,
    smsCountDown: 0,
    cur: {
      usrId: '',
      smsCode: '',
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
  async getSms(e) {
    let _data = this.data;
    if (_data.smsCountDown !== 0) return;
    this.setData({ smsCountDown: CONSTANTS.SMSDUR });

    const token = await TokenManager.getInstance().ensureToken();
    _data.timer = setInterval(() => {
      if (_data.smsCountDown === 0) {
        clearInterval(_data.timer);
        return;
      }
      this.setData({
        smsCountDown: _data.smsCountDown - 1
      });
    }, 1000);
    http({
      api: "/auth/v1/request/sms",
      data: {
        userId: _data.cur.usrId
      },
      method: "POST"
    }).then(res => {
      wx.showModal({ title: res.data.message, content: "验证码2分钟内有效，请及时登录！" });
    });
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    let tokenSM = TokenManager.getInstance();
    // console.log(tokenSM)
    const params = {
      sm: token || 'no_token',  // 如果没有token，给一个默认值
      state: state,
      org: 'pages/person/login/index'
    };
    const url = `/pages/person/loading/index?sm=${encodeURIComponent(params.sm)}&state=${encodeURIComponent(params.state)}&org=${encodeURIComponent(params.org)}`;
    console.log('导航URL:', url);
    // wx.navigateTo({url:"pages/person/loading/index?sm="+tokenSM+"&state="+TokenState+"&org="+"pages/person/login/index"})
    wx.navigateTo({
      url: url,
      success: (res) => {
        console.log('导航成功:', res);
      },
      fail: (err) => {
        console.error('导航失败:', err);
        this.showError('页面跳转失败');
      }
    });
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})