// auth.js

// 初始检查
export async function performInitialCheck(app) {
    // console.log("app:"+app) // undefined
    try {
        // 设置检查状态
        app.globalData.auth.state = 'checking';
        const isTokenValid = await validateToken(app);
        if (isTokenValid) {
            await checkSessionAndNavigate(app);
        } else {
            startRetry(app);
        }
    } catch (error) {
        console.error('初始验证失败:', error);
        app.globalData.auth.state = 'invalid';
        startRetry(app);
    }
}

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
                console.log("isActive : " + isActive);
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
                resolve(response.data.isLogined);
            },
            fail: (error) => {
                console.error('Cookie检查失败:', error);
                reject(error);
            }
        });
    });
}

// 验证token
async function validateToken(app) {
    // 防止重复检查
    if (app.globalData.auth.isChecking) {
        console.log('正在验证中，跳过');
        return false;
    }
    app.globalData.auth.isChecking = true;
    app.globalData.auth.state = 'checking';
    try {
        // 1. 检查本地token
        const storedToken = wx.getStorageSync('token');
        let currentToken = storedToken;
        // 2. 如果没有token，尝试刷新
        if (!storedToken || storedToken.trim() === '') {
            console.log('本地存储没有token，正在获取…');
            await refreshToken(app.globalData.baseURL);
            currentToken = wx.getStorageSync('token');
        }
        // 3. 验证token有效性
        if (currentToken) {
            const tokenValid = await isTokenActive(app.globalData.baseURL, currentToken);
            if (!tokenValid) {
                console.log('token无效，尝试刷新...');
                await refreshToken(app.globalData.baseURL);
                currentToken = wx.getStorageSync('token');
                if (!currentToken) throw new Error('刷新token失败');
                // 验证刷新后的token
                const newTokenValid = await isTokenActive(app.globalData.baseURL, currentToken);
                if (!newTokenValid) throw new Error('刷新后的token仍然无效');
            }
            // 4. 更新全局token
            app.globalData.auth.token = currentToken;
            app.globalData.auth.state = 'valid';
            app.globalData.auth.currentRetryCount = 0; // 重置重试计数
            return true;
        }
        throw new Error('无法获取有效token');
    } catch (error) {
        console.error('验证token失败:', error);
        app.globalData.auth.state = 'invalid';
        return false;
    } finally {
        app.globalData.auth.isChecking = false;
    }
}

// 检查session并导航
async function checkSessionAndNavigate(app) {
    try {
        const sessionValid = await isCookieActive(
            app.globalData.baseURL,
            app.globalData.auth.token
        );
        if (sessionValid) {
            console.log('验证通过，跳转到首页');
            app.globalData.auth.state = 'valid';
            await navigateToHome();
            return true;
        } else {
            console.log('session无效，需要重新登录');
            app.globalData.auth.state = 'expired';
            navigateToLogin();
            return false;
        }
    } catch (error) {
        console.error('检查session失败:', error);
        app.globalData.auth.state = 'invalid';
        return false;
    }
}

// 启动重试机制
function startRetry(app) {
    console.log('启动重试机制...');
    // 清除之前的定时器
    stopRetry(app);
    app.globalData.auth.currentRetryCount = 0;
    app.globalData.auth.retryTimer = setInterval(async () => {
        app.globalData.auth.currentRetryCount++;
        console.log(`第 ${app.globalData.auth.currentRetryCount} 次重试...`);
        // 超过最大重试次数
        if (app.globalData.auth.currentRetryCount >= app.globalData.auth.maxRetryCount) {
            wx.exitMiniProgram({
                success: (res) => { console.error('达到最大重试次数，小程序初始化失败，已退出'); },
                fail: (res) => { console.error('达到最大重试次数，小程序初始化失败，退出出现错误'); }
            })
            return;
        }
        try {
            const tokenValid = await validateToken(app);
            if (tokenValid) {
                console.log('重试验证成功');
                stopRetry(app);
                await checkSessionAndNavigate(app);
            }
        } catch (error) {
            console.error('重试过程中出错:', error);
        }
    }, 5000);
    // 每5秒重试一次
}

// 停止重试
function stopRetry(app) {
    if (app.globalData.auth.retryTimer) {
        clearInterval(app.globalData.auth.retryTimer);
        app.globalData.auth.retryTimer = null;
        console.log('已停止重试机制');
    }
}

// 导航到首页
async function navigateToHome() {
    return new Promise((resolve) => {
        setTimeout(() => {
            wx.switchTab({
                url: '/pages/home/index',
                success: () => {
                    console.log('跳转到首页成功');
                    resolve(true);
                },
                fail: (err) => {
                    console.error('跳转到首页失败:', err);
                    resolve(false);
                }
            });
        }, 500);
    });
}
// 导航到登录页
function navigateToLogin() {
    wx.reLaunch({ url: '/pages/login/index' });
}