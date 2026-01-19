// pages/person/profile/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  tobindWx() {
    let _this = this
    wx.getUserProfile({
      desc: '获取你的昵称、头像、地区及性别',
      success: res => {
        let userInfo = res.userInfo;
        _this.setData({
          userInfo: userInfo
        })
        wx.setStorageSync("userInfo", userInfo)
        userInfo.uid = _this.getUserId();
        apis.updateUser(userInfo).then(res => {
          //console.log('updateUser', res);
          if (res) {
            utils.showWxToast('授权成功');
          } else {
            utils.showWxToast('授权失败，请去联系管理员');
          }
        });
      },
      fail: res => {
        //拒绝授权
        wx.showToast({
          title: '您拒绝了请求',
          icon: 'error',
          duration: 2000
        });
        return;
      }
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