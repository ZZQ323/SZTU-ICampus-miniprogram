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
const  setFunction = (arr) => {
    return [...new Set(arr)]
}

// 去重函数
const isEmptyString = str =>{
    return  str===null || str.trim().equals("");
}

module.exports = {
    formatTime: formatTime,
    showWxToast: showWxToast,
    getTouchData: getTouchData,
    buildDate: buildDate,
    formatDate: formatDate,
    validEmail: validEmail,
    setFunction:setFunction,
    isEmptyString:isEmptyString
}
