// auth.js
export function isTokenActive(baseURL, token) {
    return new Promise((resolve, reject) => {
        wx.request({
            url: baseURL + '/v1/wx-auth/active',
            method: 'POST',
            header: {
                'Content-Type': 'application/json',
                'token': token
            },
            success: (response) => {
                const { msg } = response.data?.data || {};
                resolve(msg === "success");
            },
            fail: (error) => {
                console.error('Token检查失败:', error);
                reject(error);
            }
        });
    });
}

export function isCookieActive(baseURL, token) {
    return new Promise((resolve, reject) => {
        wx.request({
            url: baseURL + '/v1/status/session',
            method: 'GET',
            header: {
                'Content-Type': 'application/json',
                'token': token
            },
            success: (response) => {
                resolve(response.statusCode === 200);
            },
            fail: (error) => {
                console.error('Cookie检查失败:', error);
                reject(error);
            }
        });
    });
}