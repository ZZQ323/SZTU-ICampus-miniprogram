// auth.js


// 更新 storage 的 token
export async function refreshToken(baseURL) {
    return new Promise((resolve, reject) => {
        wx.login({
            success: (loginRes) => {
                wx.request({
                    url: baseURL + '/wx-auth/v1/get-token',
                    method: 'POST',
                    header: {
                        'Content-Type': 'application/json'
                    },
                    data: { wxCode: loginRes.code },
                    success: (response) => {
                        if (response.data && response.data.data && response.data.data.token) {
                            const { token } = response.data.data;
                            console.log("获取到新token：" + token);
                            wx.setStorageSync('token', token);
                            resolve(token);
                        } else {
                            reject(new Error('获取token失败'));
                        }
                    },
                    fail: (error) => {
                        reject(error);
                    }
                });
            },
            fail: (error) => {
                reject(error);
            }
        });
    });
}

export function isTokenActive(baseURL, token) {
    return new Promise((resolve, reject) => {
        wx.request({
            url: baseURL + '/wx-auth/v1/active',
            method: 'GET',
            header: {
                'Content-Type': 'application/json',
                'token': token
            },
            success: (response) => {
                const isActive = response.data.data;
                console.log("isActive : "+isActive);
                resolve(isActive);
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
            url: baseURL + '/auth/v1/status/session',
            method: 'GET',
            header: {
                'Content-Type': 'application/json',
                'token': token
            },
            success: (response) => {
                resolve(response.code === 200);
            },
            fail: (error) => {
                console.error('Cookie检查失败:', error);
                reject(error);
            }
        });
    });
}