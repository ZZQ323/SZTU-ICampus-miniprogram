// pages/person/loading/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    curstep: 0,
    _sm: {},
    _stateConstant: {},
    _orignalURL: '',

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log(options);
    const { sm, state, org } = options;
    this.setData({
      _sm: sm,
      _stateConstant: state,
      _orignalURL: org
    });
    this.checkState();
  },
  checkState() {
    this.data._sm.on("stateChange", (payload) => {
      this.setData({
        curstep: this.data._sm.getState()
      });
    });
    this.data._sm.ensureToken()
      .then((result) => {
        wx.reLaunch({ url: this.data._orignalURL });
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