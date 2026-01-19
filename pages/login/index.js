// login.js
// import { loginUrl,smsUrl } from '../utils.js';
const { performInitialCheck } = require('../../utils/auth');

const app = getApp(); // 获取 App 实例
Page({
  data: {
    curUsrId: '',
    curCode: '',
    loginTypes: [],       // 登录类型
    isInputing: false,       // 显示学号提示
    originalUsrIds: [],   // 拉取提示
    filterUsrIds: [],     // 进行匹配筛选后建议
    // 防止sms连击
    countdown: 0,
    isSending: false,
    isLogining: false,
    rememberAcc:false
  },
  onLoad(options) {
  },
  onShow: function () {
    // 页面显示
    console.log("login.js onLoading");
    console.log("全局 token:" + app.globalData.auth.token);
    this.slientIntialize();
    this.possibleAccountHint();
  },
  slientIntialize() {
    // 重新初始化 redis的cookie
    wx.request({
      url: app.globalData.baseURL + '/auth/v1/cookie/refresh',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'token': app.globalData.auth.token
      },
      success: (response) => {
        const result = response.data.data;
        console.log("响应数据的所有键:", Object.keys(result));
        // ["cookies", "content", "loginTypes", "logined"]
        // console.log("result：" + result);
        // console.log("result.logined" + result['logined']);
        if(result['logined']){
          // 更新基础信息
          this.updateDataset(result);
          wx.switchTab({
            url: '/pages/home/index',
            success: function(res){},
            fail: function() {},
            complete: function() {}
          })
        }
        // TODO 完成带ocr的模块
        this.setData({ loginTypes: result['loginTypes'] });
      }
    });
  },
  possibleAccountHint() {
    // 取得可能的 userIds
    wx.request({
      url: app.globalData.baseURL + '/auth/v1/history',
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'token': app.globalData.auth.token
      },
      success: (response) => {
        let userIds = response.data.data;
        userIds = userIds === null || userIds === undefined ? [] : userIds;
        this.setData({ originalUsrIds: userIds });
      }
    });
  },
  onUsrIdInput(e) {
    const inputV = e.detail.value?.trim() || '';
    // console.log("inputV:"+inputV);
    this.setData({
      curUsrId: inputV,
      isInputing: true
    });
    // 展示提示
    if (this.data.curUsrId.length > 0) {
      const filterIds = this.data.originalUsrIds.filter(ele => { return ele.startsWith(this.data.curUsrId); });
      this.setData({ filterUsrIds: filterIds });
    } else {
      this.setData({ filterUsrIds: this.data.originalUsrIds });
    }
  },
  onUsrIdFocus(e) {
    // 从data中取当前输入的 userId  修复作用域问题
    // const query = this.createSelectorQuery();
    // console.log(query.selectAll('.hint'));
    // console.log(query.selectAll('.hint').fields({properties:true}));

    // 展示提示
    this.setData({
      isInputing: true
    });
  },
  onUsrIdBlur(e) {
    this.setData({
      isInputing: false
    });
  },
  onCodeInput(e) {
    const inputV = e.detail.value?.trim() || '';
    this.setData({
      curCode: inputV
    });
  },
  onSelectHint(e) {
    // console.log('=== 点击事件调试 ===');
    // 检查事件类型
    // console.log('事件类型:', e.type); // 事件类型: tap
    // 检查目标元素
    // console.log('目标元素 id:', e.currentTarget.id); //目标元素 id: 
    // console.log('目标元素 class:', e.currentTarget.className);  //目标元素 class: undefined
    //console.log('目标元素 dataset:', e.currentTarget.dataset);  //目标元素 dataset: {value: "202200202104"}
    // 检查 data-value 是否正确传递
    // console.log('data-value 值:', e.currentTarget.dataset.value);//data-value 值: 202200202104
    // 防止事件冒泡（如果需要）
    // e.stopPropagation();
    // 获取值并处理
    const value = e.currentTarget.dataset.value;
    if (value) {
      console.log('成功获取到值:', value);
      this.setData({
        curUsrId: value,
        isInputing: false
      });
      // 可选：触发输入框的 change 事件（如果需要）
      // this.triggerInputChange(value);
    } else {
      console.warn('未获取到 data-value 值');
    }
  },
  onSendSmsCode(e) {
    // 检查是否正在发送或倒计时中
    if (this.data.isSending || this.data.countdown > 0)
      return;
    if (this.data.curUsrId === null || this.data.curUsrId.length <= 0) {
      wx.showToast({ title: '请先输入工号', icon: 'none' });
      return;
    }
    // 防连击
    this.setData({ isSending: true });
    this.startCountdown(60);
    // 请求
    wx.request({
      url: getApp().globalData.baseURL + "/auth/v1/request/sms", // 接口地址
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'token': app.globalData.auth.token
      },
      data: {
        userId: this.data.curUsrId,
      },
      success: (res) => {
        console.log('请求验证码接口返回：', res.data);
        if (res.statusCode === 200) {
          wx.showToast({
            title: '验证码已发送',
            icon: 'success',
            duration: 2000
          });
        }
        else {
          // 请求失败回调（网络错误、接口不可达等）
          wx.showToast({
            title: res.data.msg || '请求验证码异常，请检查账号密码',
            icon: 'error',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('验证码请求失败：', err);
        wx.showToast({
          title: '网络异常，请稍后重试',
          icon: 'error',
          duration: 2000
        });
        // 重置发送状态
        this.resetCountdown();
      }
    });
  },
  // === 倒计时处理 ===
  startCountdown(seconds) {
    // 先清除可能存在的定时器
    this.clearCountdown();
    this.setData({ countdown: seconds });
    // 设置定时器
    const timer = setInterval(() => {
      const newCountdown = this.data.countdown - 1;
      if (newCountdown <= 0) {
        this.resetCountdown();
      } else {
        this.setData({ countdown: newCountdown });
      }
    }, 1000);
    this.setData({ countdownTimer: timer });
  },
  // === 重置倒计时 ===
  resetCountdown() {
    this.clearCountdown();
    this.setData({
      countdown: 0,
      isSending: false
    });
  },
  // === 倒计时终止 ===
  clearCountdown() {
    if (this.data.countdownTimer) {
      // 清除定时器
      clearInterval(this.data.countdownTimer);
      this.setData({ countdownTimer: null });
    }
  },

  // === 显示错误 ===
  showError(message) {
    this.setData({ errorMsg: message });
    setTimeout(() => {
      this.setData({ errorMsg: '' });
    }, 3000);
  },

  onTapSubmit(e) {
    if (!this.data.curUsrId) {
      wx.showToast({ title: '请输入学号', icon: 'none' });
      return;
    }
    if (!this.data.curCode) {
      wx.showToast({ title: '请输入密码/验证码', icon: 'none' });
      return;
    }
    wx.showLoading({
      title: '登录中...',
      mask: true
    });
    this.setData({
      isLogining: true
    });

    // 发送POST请求
    wx.request({
      url: getApp().globalData.baseURL + "/auth/v1/login/sms", // 接口地址
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'token': app.globalData.auth.token
      },
      data: {
        userId: this.data.curUsrId,
        smsCode: this.data.curCode,
        loginType: "SMS"
      },
      success: (res) => {
        console.log('登录接口返回：', res.data);
        if (res.statusCode === 200) {
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 2000
          });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/home/index' });
          }, 2000);
          // 持久化储存
          // if (rememberAcc) {
          //   newArrays = wx.getStorageSync('usrIds');
          //   newArrays.push(this.data.curUsrId);
          //   newArrays = setFunction(newArrays);
          //   wx.setStorageSync('usrIds', {
          //     acceptedArrays: newArrays
          //   });
          //   console.log("已进行本地持久化储存");
          // }
          updateDataset(res.data);
        } else {
          wx.showToast({
            title: res.data.msg || '登录失败，请检查账号密码',
            icon: 'none',
            duration: 2000
          });
        }
      },
      // 请求失败回调（网络错误、接口不可达等）
      fail: (err) => {
        console.error('登录请求失败：', err);
        wx.showToast({
          title: '登录时出现错误，请稍后重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
    this.setData({ isLogining: false });
  },

  // === 记忆勾与持久化储存 ===
  onRememberChange(e) {
    console.log("rememberAcc becomes: "+e.detail.value);
    this.setData({rememberAcc:e.detail.value});
  },

  updateDataset(resData) {
    console.log(Object.getOwnPropertyNames(resData));
    app.globalData.userInfo.userId = resData.userId;
    app.globalData.userInfo.realName = resData.realName;
    app.globalData.userInfo.gender = resData.gender;
    app.globalData.userInfo.department = resData.schoolName;
  },
  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  async onPullDownRefresh() {
    // console.log("this："+this)
    // console.log("globalThis："+globalThis)
    
    await performInitialCheck(globalThis.app);
  },
});