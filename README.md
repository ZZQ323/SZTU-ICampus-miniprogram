# SZTU-ICampus-miniprogram

> 项目前端：https://github.com/ZZQ323/SZTU-ICampus-miniprogram  
> 项目后端：https://github.com/ZZQ323/SZTU-iCampus-backend

## 检查状态机

状态流转说明：
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  IDLE ──────────────────────────────────────────────────────┐   │
│    │                                                        │   │
│    ▼                                                        │   │
│  TOKEN_CHECKING ────────────────────────────────────────┐   │   │
│    │                                                    │   │   │
│    ├──► TOKEN_REFRESHING ───┐                           │   │   │
│    │         │              │                           │   │   │
│    │         ▼              │                           │   │   │
│    │    TOKEN_VALID ◄───────┘                           │   │   │
│    │         │                                          │   │   │
│    │         ▼                                          │   │   │
│    │  SESSION_CHECKING ─────────────────────────────┐   │   │   │
│    │         │                                      │   │   │   │
│    │         ├──► SESSION_VALID (已登录) ──────────►│   │   │   │
│    │         │                                      │   │   │   │
│    │         └──► SESSION_EXPIRED (需登录) ────────►│   │   │   │
│    │                                                │   │   │   │
│    │                                                │   │   │   │
│    └──► TOKEN_INVALID ─────────────────────────────►│   │   │   │
│                                                     │   │   │   │
│    ┌────────────────────────────────────────────────┘   │   │   │
│    │                                                    │   │   │
│    ▼                                                    │   │   │
│  ERROR ◄────────────────────────────────────────────────┘   │   │
│    │                                                        │   │
│    ▼                                                        │   │
│  RETRYING ──────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

使用方式：
```js
// 方式一：使用 ensureToken（推荐）
async function fetchUserProfile() {
    const token = await authManager.ensureToken();
    
    if (!token) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return null;
    }
    
    return wx.request({
        url: 'https://api.com/user/profile',
        header: { token },
    });
}

// 方式二：检查 session 状态
async function fetchProtectedData() {
    // 确保已登录
    const isLoggedIn = await authManager.ensureLoggedIn();
    
    if (!isLoggedIn) {
        // 跳转登录页
        wx.navigateTo({ url: '/pages/login/index' });
        return null;
    }
    
    // 执行需要登录的操作
    return someApiCall();
}
```



