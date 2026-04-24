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

### ⚠️ 硬性规则：信息流禁用前端轮询，必须 WS 推式

本项目已验证微信小程序 WS 长连通道可用（FAB 红点、徽章水位线已在用），但历史上多次把"WS + 列表"实现成「WS 当信号枪 → 触发 HTTP fetch」的伪推送模式。这是 **反模式**。

**定义的"真推送"**：

| 角色 | 职责 |
|---|---|
| 后端 `CrawlEngine.broadcastNewContent` | WS payload 必须带完整 `items: InfoItemMeta[]`，不是只 id 列表 |
| 前端 `info store.handleWsMessage` | 收到后直接 `prependChannelItems(channelId, items)` 进 store |
| 前端 `notice.vue.list` | 改为 `computed(() => infoStore.getChannelList(channelId))` —— 响应式，DOM 自动 unshift |
| 前端 `notice.vue.onShow` | **不得**调用 `fetchList(true)` |

**HTTP fetch 仅允许以下三种用途**：
1. **冷启动**：页面首次挂载拉一次初始列表（`onMounted`，非 `onShow`）
2. **下拉刷新**：用户主动 `onPullDownRefresh`，补齐 WS 断连期间 missed
3. **分页加载**：`onReachBottom` 拉更老的历史

**禁止**：
- ❌ `onShow` 里 `fetchList(true)` —— 每次返回都 reset 列表 = 轮询换皮
- ❌ WS 收到 NEW_CONTENT 后再调用 HTTP —— 这是 WS 做信号枪，典型反模式
- ❌ 后端 payload 只给 id 列表让前端按 id 拉 —— 同理

**AI 修改提示**：如果下一个 session 又想在 WS 消息 handler 里加 `fetch*()`，或者在 `onShow` 里加 `fetchList`，**必须先回头读这节**。流式推送是论文核心论点，不可降级。

### WS 技术事实（微信小程序）

- **可用**：`uni.connectSocket` 已在 `src/utils/websocket.ts` 跑通
- **单消息 ≤ 1 MB**：一条 WS 消息带 10 条 InfoItemMeta ≈ 5-8KB，充裕
- **切后台 5 分钟 WS 会被 iOS WeChat 杀**：依赖已有的指数退避重连 + 下拉刷新补偿
- **切网络（WiFi↔4G）会断**：同上
- **DevTools 和真机行为不完全一致**：以真机为准


## 项目结构

```
src/
├── api/                  # API 定义
│   ├── auth-apis.ts       # 认证、会话
│   ├── info-api.ts        # 信息流（getFeed 支持 sourceIds 订阅）
│   ├── schedule-apis.ts   # 课表
│   └── calendar-apis.ts   # 校历（years + year detail）
├── store/modules/        # Pinia 状态管理
│   ├── auth.ts            # 认证阶段机
│   ├── user.ts            # 用户信息、登录/登出
│   ├── info.ts            # 信息流未读（三层分治）+ WS 订阅过滤
│   ├── subscription.ts    # source 订阅集合（Record，20 上限，持久化）
│   └── ws.ts              # WebSocket 连接
├── hooks/                 # Vue Composables
│   ├── useAuthGuard.ts    # 认证守卫
│   ├── useSchedule.ts     # 课表数据处理
│   └── useCountdown.ts    # 倒计时
├── utils/
│   ├── cookie-manager.ts / http.ts / websocket.ts / tdesign.ts
│   ├── storage.ts / navigate.ts / date.ts
├── components/
│   ├── PageLayout.vue
│   ├── FloatingNotification.vue
│   ├── BadgeDot.vue
│   ├── common/NewMessageToast.vue
│   └── info/
│       ├── InfoListItem.vue    # 文章列表项（已读态灰化，readIds 用 Record）
│       ├── SourcePicker.vue    # 信息源选择器（含"已订阅"入口）
│       └── FilterDrawer.vue    # 临时筛选弹层（订阅子集 + 三态 checkbox）
├── pages/
│   ├── home/home.vue                      # 首页（2×3 入口：信息流/课表/校历，后续加活动日历）
│   ├── schedule/schedule.vue              # 课表（软登录，空态引导去登录）
│   ├── notice/notice.vue                  # 信息流（订阅模式 + 临时筛选 + 管理订阅入口）
│   ├── notice/detail.vue                  # 文章详情
│   ├── notice/subscribe.vue               # 订阅管理（使用 store，20 上限提示）
│   ├── school-calendar/school-calendar.vue # 校历（学年 timeline + 双学期图 + 预览保存）
│   ├── calendar/calendar.vue               # 活动日历（stub，Step B 会重构）
│   └── common/login/login.vue              # SMS + 密码登录
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

## 订阅管理 + 视图筛选

订阅 = 减噪开关，source 粒度。

- **唯一真理源**：`subscription` store 里 `subscribedMap: Record<string, true>`，上限 20 个
- **持久化**：`uni.storage` key `icampus_subscribed_sources`（数组形式，兼容老版本）
- **三态 UI**：SourcePicker 里有"已订阅"入口 → 进 notice 的 subscribed 模式
- **管理入口**：notice 页右上角"管理订阅"按钮跳 `subscribe.vue`
- **临时筛选**：notice 搜索框下"筛选"按钮开 `FilterDrawer`（分类→频道→source 三层 checkbox），关闭即失效

**订阅模式下的 feed**：
```
subscribed 模式 → getFeed({ sourceIds: subscriptionStore.sourceIdsCsv, pageSize: 20 })
空订阅 → 显示引导"去管理订阅"
```

**WS 过滤**：`info.store.handleWsMessage` 里
```ts
if (!subscription.isEmpty && sourceId && !subscription.isSubscribed(sourceId)) return
```
空订阅回退到全量推送（冷启动不提示用户配置）。

## 校历（school-calendar.vue）

学校官网 `www.sztu.edu.cn/xxgk/xxxl/a{y}___{y+1}xnd.htm` 每学年一页，页内 `div.xl1` 有春秋两张图。后端爬 + 解析 + /proxy/image 包装。

前端布局：左侧学年时间轴（圆点 + 连线）+ 右侧双卡片（秋季/春季）。点图 `uni.previewImage`（长按保存）。Map 缓存已加载学年，切换不重发。

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

### 详情页 HTML 渲染：用 mp-html，不用原生 rich-text

小程序原生 `<rich-text>` 致命局限：**没有事件系统**——图片不能放大、链接不能响应点击。早期用 `normalizeHtml()` 注入 inline style 凑合看，但无法解决交互缺失。

**当前方案：`mp-html` 库**（`pnpm add mp-html`）
- 在 `pages.json` 的 `easycom` 配置里注册：`"^mp-html$": "mp-html/dist/uni-app/components/mp-html/mp-html.vue"`，`<mp-html>` 标签全局可用
- 替换 `<rich-text :nodes>` → `<mp-html :content="html" :tag-style="TAG_STYLE" @linktap="onLinkTap">`
- **TAG_STYLE** 是一个 `{ p: "...", h1: "...", a: "...", ... }` 对象，按标签注入默认样式；比 `normalizeHtml` 的正则替换更稳定
- `@linktap` 自定义外链行为：`mp.weixin.qq.com → web-view`，其他外链 → `uni.setClipboardData` + toast
- 图片预览、表格滚动、lazy-load 都是 mp-html 内置，**无需再写任何代码**
- 已删除旧的 `normalizeHtml()` 正则函数，不再需要

**规则：显示问题从前端调，后端只管数据。**

### 附件下载必须走 /proxy/attachment（不要 uni.downloadFile 直连学校 URL）

**问题**：`uni.downloadFile` 不走 axios 拦截器，不会自动附加 `X-School-Cookies` header。直连学校/WebVPN URL 时学校看不到 cookie → 返回 200 + 登录表单 HTML → `openDocument` 拿到垃圾 HTML 打不开。现象：两边日志都没报错，但用户看到"打开失败"toast，没人看得见根因。

**正确路径**：
1. 前端把 URL 改写成 `${BASE_URL}/proxy/attachment?url=<原始URL>&filename=<文件名>`
2. 同时把 `X-School-Cookies` + `X-User-Id` 通过 `uni.downloadFile({ header })` 传给后端
3. 后端 `ProxyController.proxyAttachment` 带 cookie 请求学校，嗅探伪 200 HTML 登录页 → 判 404 → 前端给"登录过期"提示
4. 下载成功后 `uni.openDocument({ showMenu: true })` — `showMenu` 必须为 `true`，微信文档预览页的"…"菜单才会出现"发送给朋友/保存到手机/其他应用打开"——**这就是附件的转发入口**

**工具入口**：`src/utils/attachment.ts`
- `buildProxyAttachmentUrl(rawUrl, filename)` / `buildProxyImageUrl(rawUrl)`
- `attachmentHeaders()` 返回 `{ 'X-School-Cookies', 'X-User-Id' }`
- `isImageAttachment(att)` 判 type==='image' 或扩展名
- `describeDownloadError(statusCode, errMsg)` 统一错误文案

**图片类附件**走 `uni.previewImage({ urls: [buildProxyImageUrl(url)] })`，不走 downloadFile；`/proxy/image` 是公开端点，不需要 cookie（学校图片资源多为公开）。

**页面转发**（区别于"附件转发"）：`onShareAppMessage` + `onShareTimeline` + `uni.showShareMenu({ menus:['shareAppMessage','shareTimeline'] })`，用户点右上角胶囊即可。path 带上 channelId/id/category，好友点开直达详情页。

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

### 软登录 vs 强制登录（课表页踩过的坑）

**规则**：home / notice / calendar 都用"软登录" —— 未登录也能进页面，看到框架，需要数据的地方才提示去登录。**不要用 `ensure({ requireSchoolLogin: true })` 自动 navigate 到登录页**——用户点一个按钮就被踢到登录页非常粗暴。

课表页的现在做法（参考）：
- `ensure({ requireSchoolLogin: false })` — 不强制
- 控件 `:class="{ disabled: !isLoggedIn }"` + `pointer-events: none` 灰出
- 空态块 "登录后可查看课表" + 灰底 pill 按钮让用户自己决定点不点
- `onShow` 里判 `isLoggedIn` 才 fetch

### 活动日历（已完成，Step A+B1+B2+B3）

后端通过 `/admin/activity/scan-recent` 手动触发抽取，LLM 判定 + Redis 索引。前端 `calendar/calendar.vue` 全新实现。

**文件组织**：
- `src/api/activity-apis.ts` —— 4 个查询 + 1 个 report
- `src/types/activity.ts` —— ActivityItem / ActivityStats / ReportReason
- `src/pages/calendar/calendar.vue` —— 月历 UI（非 stub）
- `src/pages/home/home.vue` —— 四宫格入口（信息流/课表/校历/活动日历）

**月历 UI 要点**：
- 手画 6×7 网格（不用 t-calendar，灵活性差）
- 每个日期 cell 下方显示活动类型小标签（最多 2 个 + "+N" 溢出）
- 今日蓝底圆点、选中日蓝底背景
- 下方分两部分：**选中日活动列表** + **底部 tab（即将到来 / 时间待定）**
- 数据策略：mount 时一次性拉 `getUpcoming(100, includePast=true)`，月历/选中日/即将到来**共用同一份内存数据**；pending 懒加载

**B3 报告错误 UI**：
- 每张活动卡右上角 `⋯` 图标（`t-icon name="more"`）
- `@tap.stop="onReport"` 阻止冒泡到卡片的 onOpenArticle
- `uni.showActionSheet` 弹 5 个原因（not_activity / wrong_time / wrong_title / wrong_location / other）
- 成功 toast "感谢反馈"

**论文素材**（后端 CLAUDE.md 里有完整版）：本系统在 announcement+job 预告类频道 F1=0.95，前端月历 + 用户反馈形成识别 → 反馈 → 迭代闭环。

### 活动日历的"频道差异化策略"

（前端层需要理解这个设计）

后端默认只扫 `announcement` + `job` 两个频道，不扫 news / campus-life 等。原因：实验证实后两者 100% 是事后报道，活动已经发生。日历 UI 应强调**即将到来**，事后报道不进来是对的。

Home 页"活动日历"按钮进入时，用户直接看到的是月历，点日期看具体活动。**不需要前端再做频道筛选**，后端已经锁定了数据来源。
