// pages/person/login/index.js
import CONSTANTS from "../../../utils/constant";
import http from "../../../api/http";
import { SessionManager } from "../../../utils/sessionManager";

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
    _data.timer = setInterval(() => {
      if (_data.smsCountDown === 0) {
        clearInterval(_data.timer);
        return;
      }
      this.setData({
        smsCountDown: _data.smsCountDown - 1
      });
    }, 1000);
    // 确保 session 有效（会自动先确保 token）
    await SessionManager.getInstance().ensureSession();
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
  async onLoad(options) {
    // 确保 session 有效（会自动先确保 token）
    await SessionManager.getInstance().ensureSession();
    http({
      api: "/auth/v1/cookie/refresh",
      method: "GET"
    }).then(res => {
      console.log(Object.keys(res.data.data));
      if (res.data.data.Logined) {
        wx.showModal({ 
          title: res.data.message, content: "登录仍有效！" 
        });
        wx.reLaunch({ url: 'pages/home/index', })
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