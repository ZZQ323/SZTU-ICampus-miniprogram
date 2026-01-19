import {
    http, uploadFile, uploadFileToOcr
} from 'http.js'
const fs = wx.getFileSystemManager();
var url = {
    // 后端api合集
    initSession:"/auth/v1/cookie/refresh",
    getPossibleUsrId:"/auth/v1/history",
    getSms:"/auth/v1/request/sms",
    smsLogin: "/auth/v1/status/session",
    usrPasswdLogin:"/auth/v1/login/passwd",
    loginSms:"/auth/v1/login/sms",
    logout:"/auth/v1/logout",
    // initShowAd: 'init/showAd'
}
module.exports = {
    userLogin(data) {
        let appId = data.appId;
        /**
         * delete操作符用于删除对象的属性。
         * 所以，delete data.appId;是合法的JavaScript代码，它的作用是删除data对象中的appId属性。
         * 但是，请注意，delete操作符的行为可能会受到对象属性描述符的影响。
         * 例如，如果属性是不可配置的，那么删除操作会失败（在严格模式下会抛出错误，非严格模式下返回false）
         */
        delete data.appId;
        return http({
            url: url.userLogin + '/' + appId,
            data: data,
            method: 'POST'
        })
    },
    
}