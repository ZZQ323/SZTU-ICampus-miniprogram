# SZTU iCampus Miniprogram - 项目知识库

## 项目定位

微信小程序前端，本质上在 **模拟浏览器**：储存 Cookie、匹配 Cookie、发送 Cookie。作为校园 Web 服务的统一入口。

## 架构：Cookie-in-Header 直通

```
小程序 ─── X-School-Cookies header ───→ 后端 ─── Cookie ───→ 学校服务
   ↑                                      │
   └──── X-Set-Cookies response header ───┘
```

- 请求拦截器自动附加 `X-School-Cookies` + `X-User-Id`
- 响应拦截器自动从 `X-Set-Cookies` 提取并存储
- 兜底：response body 中也包含 `cookiesJson`（防 uni-app 某些环境读不到自定义 header）

## 关键开发规范

### 1. TDesign v-model 问题
TDesign 小程序组件的 `v-model` 在某些环境下不工作。**统一使用 `:value` + `@change`**：

```vue
<!-- 正确 -->
<t-input :value="username" @change="onUsernameChange" />

<!-- 避免 -->
<t-input v-model="username" />
```

使用 `src/utils/tdesign.ts` 提供的 `extractString(e)` / `extractBoolean(e)` 统一处理事件格式差异。

### 2. 不使用微信 openId
全程只用学校自己签发的 cookie，不调用 `wx.login()` 获取 openId。

### 3. refresh 优先于 init
大多数"会话过期"只需 `/auth/v1/session/refresh`（像按 F5），不需要清空 cookie 重新 `/auth/v1/session/init`。

### 4. 后端不做持久化
后端只用 Redis 缓存，没有 MySQL。前端不要假设后端有持久化数据。

## 项目结构

```
src/
├── api/                  # API 定义
│   ├── auth-apis.ts      # 认证、会话
│   ├── info-api.ts       # 信息流
│   └── schedule-apis.ts  # 课表
├── store/modules/        # Pinia 状态管理
│   ├── auth.ts           # 认证阶段机（idle/checking/ready/error）
│   ├── user.ts           # 用户信息、登录/登出
│   ├── info.ts           # 信息流未读（三层分治）
│   └── ws.ts             # WebSocket 连接
├── hooks/                # Vue Composables
│   ├── useAuthGuard.ts   # 认证守卫（页面 onShow 调用）
│   ├── useSchedule.ts    # 课表数据处理
│   └── useCountdown.ts   # 倒计时
├── utils/
│   ├── cookie-manager.ts # Cookie 存取（uni.storage）
│   ├── http.ts           # Axios 拦截器（Cookie 注入/提取）
│   ├── websocket.ts      # WsClient（uni.connectSocket）
│   ├── tdesign.ts        # TDesign 事件提取工具
│   ├── storage.ts        # 本地存储（用户信息）
│   └── navigate.ts       # 路由导航
├── components/
│   ├── PageLayout.vue    # 页面外壳（遮罩+错误弹窗）
│   └── FloatingNotification.vue
├── pages/
│   ├── home/home.vue
│   ├── schedule/schedule.vue     # 强制登录
│   ├── notice/notice.vue         # 信息流（多频道）
│   ├── notice/detail.vue         # 文章详情
│   ├── calendar/calendar.vue
│   └── common/login/login.vue    # SMS + 密码登录
└── types/                # TypeScript 类型
```

## 认证流程

1. `App.vue` onLaunch → `hasAuth()` → 有 cookies 就 `checkSchoolSession()`
2. 页面 onShow → `useAuthGuard().ensure()` → 30 秒缓存，超过则重新检查
3. 登录：`initSession()` → `requestSms()` → `loginSchool()` → 自动存 cookies
4. 刷新：`refreshSession()` —— 不清 cookie，只续期
5. 重置：`resetSession()` —— 清除一切，重新 init

## HTTP 配置

- 默认超时：15 秒
- 慢接口超时：100 秒（init, refresh, login, status, schedule）
- 错误分类：`retryable: true/false`，页面据此显示重试按钮

## WebSocket

- 登录后自动连接，登出后断开
- 指数退避重连（3s, 6s, 12s...），最多 5 次
- 消息类型：`NEW_ANNOUNCEMENTS`, `ANNOUNCEMENT_DATA`, `AUTH_REQUIRED` 等

## 技术栈

- Vue 3.5 + TypeScript 5.6
- Uni-app 3.0（WeChat 小程序 + H5）
- Pinia 2.3 + pinia-plugin-persistedstate
- Axios + @uni-helper/axios-adapter
- TDesign UniApp 0.5.9
- Vite 5.4
