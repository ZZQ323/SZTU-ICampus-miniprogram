// pages/person/index.js

// userInfo: {
//   userId: '',        // 内部用户ID
//     realName: '',
//       gender: '',
//         department: '',    // 院系
//           nickname: '',      // 昵称，沿用微信昵称
//             avatarUrl: '',     // 头像，沿用微信头像
//     },

Page({
  data: {
    // 用户数据
    avatarUrl: '',
    nickname: '',
    userInfo: {},
    isUserInfoEmpty: true
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
  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo: userInfo,
      isUserInfoEmpty: Object.keys(userInfo).length === 0
    });
  },
  gotoLogin(e) {
    console.log('点击了用户信息区域', e);
    // 添加点击反馈
    wx.vibrateShort({ type: 'light' });

    // 如果用户信息为空，跳转到登录/绑定页面
    if (this.data.isUserInfoEmpty) {
      wx.navigateTo({
        url: "/pages/person/login/index",
        success: () => {
          console.log('跳转到登录页面');
        },
        fail: (err) => {
          console.error('跳转失败:', err);
        }
      });
    } else {
      // 如果已有用户信息，跳转到详情页或执行其他操作
      // wx.navigateTo({
      //   url: '/pages/userDetail/userDetail',
      // });
    }


  },
  // 选择头像
  onChooseAvatar(e) {
    console.log('选择头像:', e.detail.avatarUrl);

    // 更新头像
    this.setData({
      avatarUrl: e.detail.avatarUrl,
      showAvatarSkeleton: false // 确保骨架屏隐藏
    });

    // 这里可以上传头像到服务器
    // this.uploadAvatar(e.detail.avatarUrl);
  },
  // 上传头像到服务器（示例）
  saveAvatar(tempFilePath) {

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