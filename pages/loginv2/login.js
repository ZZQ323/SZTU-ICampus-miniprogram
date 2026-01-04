Page({
  data: {
    studentId: '',
    password: '',
    remember: false,
    array:[1,2,3]
  },
  onLoad(options) {
    // 加载本地保存的学号
    const savedStudentId = wx.getStorageSync('savedStudentId');
    if (savedStudentId) {
      this.setData({
        studentId: savedStudentId,
        remember: true
      });
    }
  },
  onReady() {
    console.log(Function.prototype.prototype);
  }
});