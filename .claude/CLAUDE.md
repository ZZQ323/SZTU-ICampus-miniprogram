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

### 3. 会话恢复：有 cookie 就 refresh，没 cookie 才 init
Cookie 在前端持久化，是否登录只有学校后端说了算。有 cookie（哪怕可能过期）→ 先 refreshSession；没 cookie → 才 initSession。

### 4. loginTypes 获取和 cookies 准备是两件事
loginTypes（登录方式列表）可以从 URL 参数、Pinia 缓存快速获取。但 cookies 必须独立保证新鲜——登录页 onLoad 必须始终刷新或初始化 cookies，不能因为 loginTypes 已获取就跳过。SMS 登录因为 getSms() 创建新 session 碰巧不受影响，但密码登录会因过期 cookies 失败。

### 5. 后端不做持久化
后端只用 Redis 缓存，没有 MySQL。前端不要假设后端有持久化数据。Redis 暂存文章摘要方便搜索，全量搜索太吃力。

### 6. 批判性思考
用户提出的想法和设计，都需要用 Plan 模式去质疑和审视。一个人说的总是会有纰漏，AI 应当做批判性分析。

### 7. 开发流程约定（AI 元规则）
- **每次开始操作前先 `git fetch`**：用户会频繁更新仓库，AI 看不到远端最新状态，操作前必须同步。
- **及时更新本知识库**：用户强调过的设计原则、架构决策、踩坑记录、约束、约定，必须立刻写进 `.claude/CLAUDE.md`，不要只依赖会话上下文（会被压缩/清空）。
- **开发分支**：所有改动推到用户指定的 `claude/*` 分支，不直接碰 `main` / `release/*`。

## 学校服务的本质

学校服务按 Cookie 需求分三类：
- **无需 Cookie**：学院部门公开信息，直接访问
- **需要网关 Cookie**：公文通，登录 WebVPN 网关后获取
- **需要教务系统 Cookie**：课表等，需处理教务系统的重定向授权链

处理重定向就是被授权 —— 获得什么 cookie，就能用什么功能。

## 会话刷新的设计考虑

"刷新会话"按钮存在的原因：
1. **学校网页加载慢**：返回了登录成功状态但没返回个人信息 —— 学校网站的问题。核心逻辑在 `refreshSession` 里解析个人信息的部分
2. **用户反复登录**：快速操作导致"会话过期"，手动刷新就能看到信息
3. **多设备切换**：挂机后回来"会话过期"

以上所有场景在浏览器里就是"点刷新"，在小程序里就是请求 `/auth/v1/session/refresh`，不需要清空 cookie 重新 init。

## 轮询与推送

项目采用 **轮询学校网页 → 爬取 → WSS 推送** 的方式，全程不使用微信小程序的 openId。后端用自研 SmartHttp 代替 Playwright 解决并发问题。

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
│   ├── navigate.ts       # 路由导航
│   └── date.ts           # 日期格式化
├── components/
│   ├── PageLayout.vue    # 页面外壳（认证遮罩+错误弹窗）
│   ├── FloatingNotification.vue
│   ├── BadgeDot.vue
│   ├── common/NewMessageToast.vue
│   └── info/
│       ├── InfoListItem.vue   # 文章列表项
│       └── SourcePicker.vue   # 信息源选择器
├── pages/
│   ├── home/home.vue                    # 首页（不要求登录）
│   ├── schedule/schedule.vue            # 课表（强制登录）
│   ├── notice/notice.vue                # 信息流（多频道三维筛选）
│   ├── notice/detail.vue                # 文章详情
│   ├── notice/subscribe.vue             # 频道订阅管理
│   ├── calendar/calendar.vue            # 活动日历
│   └── common/login/login.vue           # SMS + 密码登录
└── types/                # TypeScript 类型
    ├── auth.ts
    ├── info.ts
    ├── schedule.ts
    ├── notice.ts
    ├── calendar.ts
    └── ws-types.ts
```

## 认证流程

1. `App.vue` onLaunch → `hasAuth()` → 有 cookies 就 `checkSchoolSession()`
2. 页面 onShow → `useAuthGuard().ensure()` → 30 秒缓存，超过则重新检查
3. 登录：`initSession()` → `requestSms()` → `loginSchool()` → 自动存 cookies
4. 刷新：`refreshSession()` —— 不清 cookie，只续期
5. 重置：`resetSession()` —— 清除一切，重新 init

## 三层分治未读管理（info store）

```
Layer 1: serverLatestId  - 服务器最新 ID（API / WS 推送）
Layer 2: lastReadId      - 已读位置（本地持久化）
Layer 3: readIds         - 单条已读集合（本地持久化，上限 200）
                           ⚠️ 用 Record<string, true>，不要用 Set（见踩坑记录）

unreadCount = max(0, min(serverLatestId - lastReadId, 99))
```

频道状态持久化到 `uni.storage`，存储 key：
- `info_last_read_{channelId}` - 已读位置
- `info_read_ids_{channelId}` - 已读 ID 集合

## HTTP 配置

- 默认超时：15 秒
- 慢接口超时：100 秒（init, refresh, login, status, schedule）
- 错误分类：`retryable: true/false`，页面据此显示重试按钮

## WebSocket

- 登录后自动连接，登出后断开
- 指数退避重连（3s, 6s, 12s...），最多 5 次
- 消息类型：`NEW_ANNOUNCEMENTS`, `ANNOUNCEMENT_DATA`, `AUTH_REQUIRED`, `NEW_CONTENT`, `COOKIE_UPDATE` 等
- 连接参数：`ws://host/ws?userId=XXX&topics=announcement,schedule,calendar`

## 信息流三维筛选（notice.vue）

1. **信息源**（dropdown）：按 sourceOrg 分组（固定频道、学校官网、职能部门、学院...）
2. **分类**（pill 标签）：公文通下分教务/科研/行政/学工/校园
3. **搜索**：全局关键词搜索

## 页面路由

```
TabBar:
  /pages/home/home          - 首页
  /pages/schedule/schedule  - 课表
  /pages/notice/notice      - 信息流

子页面:
  /pages/notice/detail      - 文章详情
  /pages/notice/subscribe   - 订阅管理
  /pages/common/login/login - 登录
  /pages/calendar/calendar  - 活动日历
  /pages/common/error/error - 错误页
```

## 技术栈

- Vue 3.5 + TypeScript 5.6
- Uni-app 3.0（WeChat 小程序 + H5）
- Pinia 2.3 + pinia-plugin-persistedstate
- Axios + @uni-helper/axios-adapter
- TDesign UniApp 0.5.9
- Vite 5.4

## 开发经验（前端专用）

### 小程序 rich-text 排版

小程序 `<rich-text>` 组件不支持 Vue scoped CSS 的 `:deep()` 穿透。所有样式必须以 inline style 注入到 HTML 标签中。前端通过 `normalizeHtml()` 函数在渲染前预处理：
- `<p>`: 统一 font-size:15px, line-height:1.8
- `<img>`: 移除固定 width/height, 注入 max-width:100%
- `<span>`: 移除来源自带的 font-size/font-family
- `<h1/h2/h3>`: 分级标题 20/18/16px
- `<table/td>`: 边框和 padding

**规则：显示问题从前端调，后端只管数据。**

### 外链处理

- `mp.weixin.qq.com` → 通过 `web-view` 页面在小程序内打开
- 其他外链 → 复制链接到剪贴板
- 后端标记外链：`ArticleUrlResolver.isExternalLink()` 给 URL 加 `EXTERNAL:` 前缀
- 前端检测：`item.extra` 包含 `"external"` 则为外链

### 上下篇导航

不依赖后端的 `prevId/nextId` 解析（不同 CMS 的 HTML 结构各异）。前端在 `notice.vue` 点击文章时，将当前列表缓存到 `uni.storage`，`detail.vue` 从缓存中按位置切换。

### 课表学期生成

学期 ID 格式：`{year}-{year+1}-{1|2|3}`（如 `2025-2026-2`）。从当前年份倒推到 2017。第 3 学期（暑期）周次限制为 1-10 周，普通学期 1-22 周。

### 小程序里不要把 Set/Map 放进 Pinia 状态

Vue 3 浏览器端会代理 `Set.has/add`，但 **uni-app 小程序渲染层（setData 序列化）对 Set/Map 的变更追踪会失灵**。表现：mutate 之后 computed 不重算，视图不刷新。

踩过的坑：`info.store` 里 `readIds: Set<string>` 持久化没问题，但点击后 `InfoListItem.isReadState` 不重算，已读态不生效。根因是 `v-for :key` 复用了老组件实例，而 `Set.add` 的变更没通知到依赖它的 computed。

规避方式：
- 集合类状态一律用 `Record<string, true>`（或数组），避免 Set/Map
- 列表项 computed 里如果担心复用依赖不建立，可以显式 `void store.channelStates[id]?.xxx` 读一次
- ID 统一 `String()` 强制类型一致，避免后端偶发 number 与前端 string key 不匹配

### Boolean prop 默认值是 false，不是 undefined

Vue 3 遵循 HTML boolean attribute 语义：**声明为 `boolean` 的 prop 没传时默认是 `false`**（不是 `undefined`）。所以这种"未传则回退"的写法是错的：

```ts
// ❌ 永远命中第一行，useStore 实际上永远是 false
if (props.isRead !== undefined) return props.isRead
if (props.useStore === false) return false
```

踩过的坑：`InfoListItem` 的 `isRead?: boolean` / `useStore?: boolean` 导致 `isReadState` 恒为 `false`，已读态永远看不出变化。解决：单消费者场景直接砍掉这种"可选开关"，让组件只有一条确定路径；需要保留开关时改用字符串枚举或 `default: undefined` 显式声明。

### 已读/未读视觉设计（InfoListItem.vue）

已读未读必须对比足够明显，不能只靠标题颜色变灰：
- 已读卡片：背景 `#f7f8fa`（灰），去阴影，标题 `#999` 不加粗，tag/外链角标降透明度，日期/单位/图标降至 `#bbb/#ddd`
- 未读卡片：标题 `#181818` + `font-weight: 600`，左侧蓝色指示条 8rpx 宽
- `is-read` class 绑定依赖 `infoStore.isItemRead(channelId, id)`，channelId 缺省时走 `'announcement'`
