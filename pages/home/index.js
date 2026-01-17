// pages/home/index.js



const app = getApp();

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
  
    wx.request({
      url: app.globalData.baseURL + '/acdmadminsys/v1/schedule',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'token': app.globalData.token
      },
      data: { wxCode: res.code },
      success: (response) => {
        const { token } = response.data.data;
        console.log("收到数据：" + token);
        // 存入本地1
        wx.setStorageSync('token', token);
        app.globalData.token = token;
      }
    });
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