// pages/person/login/index.js
import CONSTANTS from "../../../utils/constant";
import http from "../../../api/http";

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loginTypes: ["短信验证登录","账号密码"],
    chosenTab:0,
    smsCountDown:0,
    cur:{
      usrId,
      smsCode,
    }
  },
  onTabsChange(event) {
    console.log(`Change tab, tab-panel value is ${event.detail.value}.`);
    this.setData({chosenTab:event.detail.value});
  },
  onTabsClick(event) {
    console.log(`Click tab, tab-panel value is ${event.detail.value}.`);
    this.setData({chosenTab:event.detail.value});
  },
  onStickyScroll(event) {
    console.log(event.detail);
    this.setData({chosenTab:event.detail.value});
  },
  getSms(e){
    if(this.data.smsCountDown!==0)return ;
    this.setData({smsCountDown:CONSTANTS.SMSDUR});
    this.data.timer = setInterval(()=>{
      if(this.data.smsCountDown===0){
        clearInterval(this.data.timer);
        return ;
      }
      this.setData({
        smsCountDown:this.data.smsCountDown-1
      });
    },1000);
    http({
      url:"/auth/v1/request/sms",
      data:{
        userId:cur.usrId
      },
      method:"POST"
    }).then(res=>{
      wx.showModal({title:res.data.message,content:"验证码2分钟内有效，请及时登录！"});
    });
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    

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