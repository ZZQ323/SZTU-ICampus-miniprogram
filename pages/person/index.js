// pages/person/index.js
Page({
  data: {
    userInfo: {}
  },
  gotoProfile() {
    wx.navigateTo({
      url: 'pages/person/profile/index',
    });
  },
  // 去登陆
  toLogin() {
    // 防止过深的递归栈
    // wx.reLaunch({ url: '/pages/login/index' });
  },
  toGiveFeedBack() {
    // wx.navigateTo({ url: "pages/person/feedback/index" });
  },
  clearCache() {
    this.setData({ userInfo: {} })
    wx.removeStorageSync("userInfo");
    wx.showToast({
      title: '清除成功',
      icon: 'none',
      duration: 2000
    });
  },
  toGetReleaseInfos() {
    // wx.navigateTo({ url: "pages/person/releaseInfo/index" });
  },
  toGetHelp() {
    // wx.navigateTo({ url: "pages/person/helps/index" });
  },
  toGetAboutAuthors() {
    // wx.navigateTo({ url: "pages/person/aboutAuthor/index" });
  },
  /** 生命周期函数--监听页面加载 */
  onLoad(options) {

  },

  /** 生命周期函数--监听页面初次渲染完成 */
  onReady() {

  },

  /** 生命周期函数--监听页面显示 */
  onShow() {

  },

  /** 生命周期函数--监听页面隐藏 */
  onHide() {

  },

  /** 生命周期函数--监听页面卸载 */
  onUnload() {

  },

  /** 页面相关事件处理函数--监听用户下拉动作 */
  onPullDownRefresh() {

  },

  /** 页面上拉触底事件的处理函数 */
  onReachBottom() {

  },

  /** 用户点击右上角分享 */
  onShareAppMessage() {

  }
})