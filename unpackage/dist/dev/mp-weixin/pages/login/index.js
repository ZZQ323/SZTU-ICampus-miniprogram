"use strict";
const common_vendor = require("../../common/vendor.js");
getApp();
Page({
  data: {
    userInfo: {
      userId: null,
      code: null
    },
    cookies: [],
    originalUsrIds: [],
    filterUsrIds: [],
    rememberAcc: false,
    isInputing: false,
    isSending: false,
    isLogining: false,
    countdownTimer: null,
    countdown: 0
  },
  onLoad(options) {
    this.setData({
      userInfo: {
        userId: null,
        code: null
      },
      cookies: [],
      originalUsrIds: [],
      filterUsrIds: [],
      rememberAcc: false,
      isInputing: false,
      isSending: false,
      countdown: 0
    });
    const usrIds = common_vendor.wx$1.getStorageSync("usrIds") || [];
    if (usrIds.length > 0) {
      this.setData({
        originalUsrIds: usrIds
      });
    }
    const localCookies = common_vendor.wx$1.getStorageSync("cookies") || [];
    if (localCookies.length > 0) {
      this.setData({
        cookies: localCookies
      });
      common_vendor.wx$1.request({
        url: getApp().globalData.baseURL + cookieLoginUrl,
        // 接口地址
        method: "POST",
        header: {
          "Content-Type": "application/json"
        },
        data: {
          cookies
        },
        success: (res) => {
          common_vendor.index.__f__("log", "at pages/login/index.vue:133", "登录接口返回：", res.data);
          if (res.statusCode === 200) {
            common_vendor.wx$1.showToast({
              title: "登录成功",
              icon: "success",
              duration: 2e3
            });
            setTimeout(() => {
              common_vendor.wx$1.switchTab({ url: "/pages/home/index" });
            }, 2e3);
            if (rememberAcc) {
              newArrays = common_vendor.wx$1.getStorageSync("usrIds");
              newArrays.push(this.data.userInfo.userId);
              newArrays = setFunction(newArrays);
              common_vendor.wx$1.setStorageSync("usrIds", {
                acceptedArrays: newArrays
              });
              common_vendor.index.__f__("log", "at pages/login/index.vue:152", "已进行本地持久化储存");
            }
            updateDataset(res.data);
          } else {
            common_vendor.wx$1.showToast({
              title: res.data.msg || "登录失败，请检查账号密码",
              icon: "none",
              duration: 2e3
            });
          }
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/login/index.vue:165", "登录请求失败：", err);
          common_vendor.wx$1.showToast({
            title: "登录时出现错误，请稍后重试",
            icon: "none",
            duration: 2e3
          });
        }
      });
    }
  },
  onUsrIdInput(e) {
    var _a;
    const inputV = ((_a = e.detail.value) == null ? void 0 : _a.trim()) || "";
    this.setData({
      "userInfo.userId": inputV,
      isInputing: true
    });
  },
  onUsrIdFocus(e) {
    var _a;
    const inputV = ((_a = e.detail.value) == null ? void 0 : _a.trim()) || "";
    if (inputV.length > 0) {
      const filterUsrIds = this.data.originalUsrIds.filter((ele) => {
        return ele.startsWith(inputV);
      });
      if (filterUsrIds.length > 0)
        this.setData({ filterUsrIds });
    } else {
      this.setData({ filterUsrIds: this.data.originalUsrIds });
    }
  },
  onUsrIdBlur(e) {
    this.setData({
      isInputing: false
    });
  },
  onCodeInput(e) {
    var _a;
    const inputV = ((_a = e.detail.value) == null ? void 0 : _a.trim()) || "";
    this.setData({
      "userInfo.code": inputV
    });
  },
  onSendSmsCode(e) {
    if (this.data.isSending || this.data.countdown > 0)
      return;
    if (this.data.userInfo.userId === null || this.data.userInfo.userId.length <= 0) {
      common_vendor.wx$1.showToast({ title: "请先输入工号", icon: "none" });
      return;
    }
    this.setData({ isSending: true });
    this.startCountdown(60);
    common_vendor.wx$1.request({
      url: getApp().globalData.baseURL + smsUrl,
      // 接口地址
      method: "GET",
      header: {},
      data: {
        id: this.data.userInfo.userId
      },
      success: (res) => {
        common_vendor.index.__f__("log", "at pages/login/index.vue:230", "请求验证码接口返回：", res.data);
        if (res.statusCode === 200) {
          common_vendor.wx$1.showToast({
            title: "验证码已发送",
            icon: "success",
            duration: 2e3
          });
        } else {
          common_vendor.wx$1.showToast({
            title: res.data.msg || "请求验证码异常，请检查账号密码",
            icon: "error",
            duration: 2e3
          });
        }
      },
      fail: (err) => {
        common_vendor.index.__f__("error", "at pages/login/index.vue:248", "验证码请求失败：", err);
        common_vendor.wx$1.showToast({
          title: "网络异常，请稍后重试",
          icon: "error",
          duration: 2e3
        });
        this.resetCountdown();
      }
    });
  },
  // === 倒计时处理 ===
  startCountdown(seconds) {
    this.clearCountdown();
    this.setData({ countdown: seconds });
    const timer = setInterval(() => {
      const newCountdown = this.data.countdown - 1;
      if (newCountdown <= 0) {
        this.resetCountdown();
      } else {
        this.setData({ countdown: newCountdown });
      }
    }, 1e3);
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
      clearInterval(this.data.countdownTimer);
      this.setData({ countdownTimer: null });
    }
  },
  // === 显示错误 ===
  showError(message) {
    this.setData({ errorMsg: message });
    setTimeout(() => {
      this.setData({ errorMsg: "" });
    }, 3e3);
  },
  onTapSubmit(e) {
    if (!this.data.userInfo.userId) {
      common_vendor.wx$1.showToast({ title: "请输入学号", icon: "none" });
      return;
    }
    if (!this.data.userInfo.code) {
      common_vendor.wx$1.showToast({ title: "请输入密码", icon: "none" });
      return;
    }
    common_vendor.wx$1.showLoading({
      title: "登录中...",
      mask: true
    });
    this.setData({
      isLogining: true
    });
    common_vendor.wx$1.request({
      url: getApp().globalData.baseURL + loginUrl,
      // 接口地址
      method: "POST",
      header: {
        "Content-Type": "application/json"
      },
      timeout: 6e4,
      data: {
        userId: this.data.userInfo.userId,
        code: this.data.userInfo.code,
        loginType: "SMS"
      },
      success: (res) => {
        common_vendor.index.__f__("log", "at pages/login/index.vue:337", "登录接口返回：", res.data);
        if (res.statusCode === 200) {
          common_vendor.wx$1.showToast({
            title: "登录成功",
            icon: "success",
            duration: 2e3
          });
          setTimeout(() => {
            common_vendor.wx$1.switchTab({ url: "/pages/home/index" });
          }, 2e3);
          if (rememberAcc) {
            newArrays = common_vendor.wx$1.getStorageSync("usrIds");
            newArrays.push(this.data.userInfo.userId);
            newArrays = setFunction(newArrays);
            common_vendor.wx$1.setStorageSync("usrIds", {
              acceptedArrays: newArrays
            });
            common_vendor.index.__f__("log", "at pages/login/index.vue:355", "已进行本地持久化储存");
          }
          updateDataset(res.data);
        } else {
          common_vendor.wx$1.showToast({
            title: res.data.msg || "登录失败，请检查账号密码",
            icon: "none",
            duration: 2e3
          });
        }
      },
      // 请求失败回调（网络错误、接口不可达等）
      fail: (err) => {
        common_vendor.index.__f__("error", "at pages/login/index.vue:368", "登录请求失败：", err);
        common_vendor.wx$1.showToast({
          title: "登录时出现错误，请稍后重试",
          icon: "none",
          duration: 2e3
        });
      }
    });
    this.setData({ isLogining: false });
  },
  // === 记忆勾与持久化储存 ===
  onRememberChange(e) {
    this.setData({
      rememberAcc: e.detail.value.length > 0
    });
  },
  updateDataset(resData) {
    const app = getApp();
    app.globalData.setData({
      cookies: this.data.cookies,
      userInfo: resData.userInfo,
      loginTimeStamp: Date.now(),
      isLoggedIn: true
    });
  }
});
const _sfc_main = {};
if (!Array) {
  const _component_template = common_vendor.resolveComponent("template");
  _component_template();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.t(_ctx.item),
    b: common_vendor.t(_ctx.countdown),
    c: common_vendor.p({
      ["wx:if"]: "{{countdown > 0}}"
    }),
    d: common_vendor.t(_ctx.isSending ? "发送中..." : "发送验证码"),
    e: common_vendor.p({
      ["wx:else"]: ""
    })
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/login/index.js.map
