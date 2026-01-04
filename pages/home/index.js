// pages/home/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log("生命周期函数--监听页面加载");
    // const usrId = wx.getStorage("usrId",(value)=>{
    // 同步获取本地存储，获取不到则返回undefined，加||做兜底
    const cookies = wx.getStorageSync('cookies') || [];
    const autoLogin = wx.getStorageSync('autoLogin') || false;
    if (autoLogin) {
      // 有usrId的逻辑
      console.log('usrId存在，并尝试自动登录', usrId);
      Promise( tryAutoLogin() )
      .then((result) => {
        
      }).catch((err) => {
        
      });
    }
    // 无usrId的兜底逻辑（比如跳转登录）
    console.log('usrId不存在，需要登录');
    wx.navigateTo({ url: '/pages/login/index' });
    
  },
  tryAutoLogin() {
    
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    console.log("生命周期函数--监听页面初次渲染完成");
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    console.log("生命周期函数--监听页面显示");
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    console.log("生命周期函数--监听页面隐藏");
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    console.log("生命周期函数--监听页面卸载");
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