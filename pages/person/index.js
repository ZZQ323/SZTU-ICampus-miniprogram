// pages/person/index.js

import SessionManager from "../../utils/managers/SessionManager";
import HttpClient from '../../utils/core/HttpClient';

Page({
  data: {
    // 用户数据
    userInfo: {
      realName: '',
      gender: '',
      userId: '',
      schoolName: '',
      avatarURL: ''
    },
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
    const sm = SessionManager.getInstance();
    sm.ensureLogin().then((value) => {
      if (value !== true) {
        value.then(value => { console.log("准备跳转！") });
        return;
      }
      wx.showLoading({ title: "正在验证用户状态！" });
      HttpClient.getInstance().post('/auth/v1/cookie/refresh', {}, {
        autoNavigateToError: false,
        showToast: true
      }).then(res => {
        // console.log(data);
        const _data = res.data;
        wx.setStorageSync("userInfo", {
          realName: _data.realName,
          gender: _data.gender,
          userId: _data.userId,
          schoolName: _data.schoolName,
          avatarURL: _data.avatarURL
        });
        this.setData({
          'userInfo.realName': _data.realName,
          'userInfo.gender': _data.gender,
          'userInfo.userId': _data.userId,
          'userInfo.schoolName': _data.schoolName,
          'userInfo.avatarURL': _data.avatarURL,
          isUserInfoEmpty: false
        });
        wx.hideLoading();
        wx.showModal({
          title: _data.realName + "您已成功登录！", content: "个人信息已加载完成", icon: "success"
        });
      });
    });
  },
  gotoLogOut(e) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (userInfo.length == 0) return;
    const copy = JSON.parse(JSON.stringify(userInfo));
    wx.showLoading({ title: "正在登出！" });
    HttpClient.getInstance().post('/auth/v1/logout', {}, {
      autoNavigateToError: false,
      showToast: true
    })
      .then(res => {
        wx.removeStorageSync('userInfo');
        // 清除SessionManager状态（重要！）
        SessionManager.getInstance().clear();
        this.setData({
          'userInfo.realName': '',
          'userInfo.gender': '',
          'userInfo.userId': '',
          'userInfo.schoolName': '',
          'userInfo.avatarURL': '',
          isUserInfoEmpty: true
        });
        wx.hideLoading();
        wx.showModal({
          title: copy.realName + "您已登出！", content: "如需使用个人功能请先登录！", icon: "success"
        });
      }).catch(err => {
        console.error('登出失败:', error);
        wx.hideLoading();

        wx.showToast({
          title: error.message || '登出失败',
          icon: 'none',
          duration: 2000
        });
      });
  },
  // 选择头像(不实现)
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