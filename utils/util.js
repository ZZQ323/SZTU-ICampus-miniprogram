const formatTime = date => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const second = date.getSeconds()

    return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatDate = date => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()


    return [year, month, day].map(formatNumber).join('-');
}

const showWxToast = toastMsg => {
    wx.showToast({
        title: toastMsg,
        icon: 'none',
        duration: 2000
    })
}

const getTouchData = (endX, endY, startX, startY) => {
    let turn = "";
    if (endX - startX > 30 && Math.abs(endY - startY) < 30) {      //右滑
        turn = "right";
    } else if (endX - startX < -30 && Math.abs(endY - startY) < 30) {   //左滑
        turn = "left";
    }
    return turn;
}

const buildDate = (str) => {
    let arr = str.split('-')
    let startDate = new Date();
    startDate.setFullYear(arr[0]);
    startDate.setMonth(parseInt(arr[1]) - 1);
    startDate.setDate(arr[2])
    startDate.setHours(0);
    startDate.setMinutes(0);
    startDate.setSeconds(0)
    return startDate;
}

const validEmail = (email) => {
    let re = /^(\w)+(\.\w+)*@(\w)+((\.\w+)+)$/;
    return (email && re.test(email));
}

// 去重函数
const setFunction = (arr) => {
    return [...new Set(arr)]
}

// 去重函数
const isEmptyString = str => {
    return str === null || str.trim().equals("");
}

//==========================================================================
//==========================================================================
//==========================================================================
//===============================鉴权函数====================================
//==========================================================================
//==========================================================================
//==========================================================================



import { SessionManager } from "./sessionManager";
import TokenManager from "./tokenManager";
async function necessaryCheck(){
    // 1. 确保 token 有效（会自动跳转到 loading 页面处理）
    const tokenManager = TokenManager.getInstance();
    await tokenManager.ensureToken();
    // 2. 确保 session 有效
    const sessionManager = SessionManager.getInstance();
    await sessionManager.ensureSession();
}

//==========================================================================
//==========================================================================
//==========================================================================
//===============================表单处理====================================
//==========================================================================
//==========================================================================
//==========================================================================

function rememberChangeHandler(e) {
    console.log(this);
    this.triggerEvent('updateRememberAcc', { rememberAcc: e.detail.value.length > 0 });
}
// 双输入登录表单 验证码or密码
function studentIdInputHandler(e) {
    const value = e.detail.value;
    this.setData({
        code: value,
        errorMsg: ''  // 清空错误信息
    });
}
function codeInputHandler(e) {

    const value = e.detail.value;
    this.setData({
        code: value,
        errorMsg: ''  // 清空错误信息
    });
}
// === 焦点处理 ===
function focusHandler(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ focusField: field });
}
function blurHandler() { this.setData({ focusField: '' }); }
function postApp(e, apiStr, preDo, PostDo) {
    // 原有登录逻辑不变
    preDo();

    // ===== 新增：POST请求登录接口 =====

}
function forgotPassword() {
    wx.showModal({
        title: '忘记密码',
        content: '忘记密码功能将跳转到密码找回页面',
        showCancel: false
    });
}

module.exports = {
    formatTime: formatTime,
    showWxToast: showWxToast,
    getTouchData: getTouchData,
    buildDate: buildDate,
    formatDate: formatDate,
    validEmail: validEmail,
    setFunction: setFunction,
    isEmptyString: isEmptyString,
    necessaryCheck:necessaryCheck
}
