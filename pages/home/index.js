// pages/home/index.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {}
  },
  /**
   * 生命周期函数--监听页面加载
   */
  gotoProfile() {
    wx.navigateTo({
      url: '/pages/my/profile',
    })
  },
  // 去登陆
  toLogin() {
    let _this = this
    wx.getUserProfile({
      desc: '获取你的昵称、头像、地区及性别',
      success: res => {
        let userInfo = res.userInfo;
        _this.setData({
          userInfo: userInfo
        });
        wx.setStorageSync("userInfo", userInfo);
        userInfo.uid = _this.getUserId();
        apis.updateUser(userInfo).then(res => {
          console.log('updateUser', res);
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
          title: '您拒绝了请求，将无法关联微信基础信息',
          icon: 'error',
          duration: 2000
        });
        return;
      }
    });
  },
  onNickNameInput(e) {
    const nickname = e.detail.value;
    this.setData({ nickname });

    const userInfo = wx.getStorageSync('userInfo') || {};
    userInfo.nickname = nickname;
    wx.setStorageSync('userInfo', userInfo);
  },

  // 将临时文件转为永久存储
  saveTempFile(tempPath) {
    wx.getFileSystemManager().saveFile({
      tempFilePath: tempPath,
      success: (res) => {
        const savedFilePath = res.savedFilePath;
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.avatar = savedFilePath; // 使用本地文件路径
        wx.setStorageSync('userInfo', userInfo);
      }
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    console.log("pages/home/index.js 生命周期函数--监听页面隐藏");
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    console.log("pages/home/index.js 生命周期函数--监听页面卸载");
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