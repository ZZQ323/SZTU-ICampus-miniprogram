// const { StreamManager } = require('./utils/stream.js')

App({
  globalData: {
    cookies: null,
    userInfo: {
      userId: '',        // 内部用户ID
      userRole: '',      // 用户角色：student/teacher/admin 等
      schoolName: '',    // 学校名称
      campus: '',        // 校区
      department: '',    // 院系
      major: '',         // 专业
      className: '',     // 班级
      grade: '' ,        // xx级录取
      nickname: '',      // 昵称，沿用微信昵称
      avatarUrl: '',     // 头像，沿用微信头像
    },
    // 登录状态
    isLoggedIn: false,
    loginTimeStamp: null,
    baseURL: 'http://localhost:8080',
    // 用户设置
    settings: {
      theme: 'light',
      notifyEnabled: true,
      autoLogin: false   
      // 记住密码选项
    },
    streamManager: null
  },
  onLaunch() {
    // 检查更新
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: function (res) {
                if (res.confirm) {
                  updateManager.applyUpdate()
                }
              }
            })
          })
        }
      })
    }

    // 获取系统信息
    wx.getWindowInfo({
      success: e => {
        this.globalData.StatusBar = e.statusBarHeight
      }
    })

    wx.getDeviceInfo({
      success: e => {
        this.globalData.CustomBar = e.platform == 'android' ? this.globalData.StatusBar + 50 : this.globalData.StatusBar + 45
      }
    })
  }
}) 