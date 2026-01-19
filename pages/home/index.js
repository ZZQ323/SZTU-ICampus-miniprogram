// pages/home/index.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    avatarUrl: '',
    nickName: '',
    userId: '',
    realName: '',
    gender: '',
    department: '',
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // 每次打开先读取本地存储
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        avatar: userInfo.avatar,
        nickname: userInfo.nickname
      });
    }
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    console.log("pages/home/index.js 生命周期函数--监听页面初次渲染完成");
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // console.log("pages/home/index.js 生命周期函数--监听页面显示");
    if (app.globalData.auth.token) {
      wx.request({
        url: app.globalData.baseURL + '/acdmadminsys/v1/schedule',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'token': app.globalData.auth.token
        },
        success: (response) => {
          const text = response.data.data;
          console.log("收到数据：" + text);
        }
      });
    }
    this.setData({
      userId: app.globalData.userInfo.userId,
      realName: app.globalData.userInfo.realName,
      gender: app.globalData.userInfo.gender,
      department: app.globalData.userInfo.department,
    });
  },
  onChooseAvatar(e) {
    const tempUrl = e.detail.avatarUrl;
    this.setData({ avatar: tempUrl });
    
    // 保存到本地
    const userInfo = wx.getStorageSync('userInfo') || {};
    userInfo.avatar = tempUrl;
    wx.setStorageSync('userInfo', userInfo);
    
    // 注意：临时路径会失效，需要转换为 base64 或保存到本地文件
    this.saveTempFile(tempUrl);
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