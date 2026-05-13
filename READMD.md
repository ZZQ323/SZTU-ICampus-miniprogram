# SZTU-Icampus-miniprogramme

校园小程序前端，uni-app（Vue 3 + Vite + TypeScript），目标平台微信小程序。

- 项目前端：https://github.com/ZZQ323/SZTU-ICampus-miniprogram
- 项目后端：https://github.com/ZZQ323/SZTU-iCampus-backend

---

## 本地启动（从仓库 clone 起步）

### 环境要求

- Node.js 18+
- pnpm 8+（**本项目使用 pnpm 管理依赖**，仓库内有 `pnpm-lock.yaml`；不要用 npm/yarn 安装，否则 lockfile 会失配）
- 微信开发者工具（用于预览编译产物）

未安装 pnpm 时：

```bash
npm i -g pnpm
# 或用 corepack：corepack enable && corepack prepare pnpm@latest --activate
```

### 安装依赖

```bash
pnpm install
```

依赖在 `package.json` 中已配齐：`pinia`、`pinia-plugin-persistedstate`、`axios`、
`@uni-helper/axios-adapter`、`tdesign-uniapp`、`less` 等。

> ⚠️ 如出现 peer 依赖冲突，可加 `--strict-peer-dependencies=false`，或
> `pnpm install --shamefully-hoist`。

### 开发与构建

```bash
pnpm dev:mp-weixin       # 开发：编译到 dist/dev/mp-weixin
pnpm build:mp-weixin     # 生产构建：dist/build/mp-weixin
pnpm dev:h5              # 可选：H5 调试
pnpm build:h5            # 可选：H5 构建
```

打开微信开发者工具，导入 `dist/dev/mp-weixin` 目录即可预览。
若首页能看到 **TDesign 的蓝色按钮**，说明环境正常。

---

## 第一步：创建项目（2 分钟）

> 下面是"从零脚手架开始搭"的历史说明，仅供参考；
> 如果你是从本仓库 clone 下来跑，按上面"本地启动"那节即可，**跳过这一节**。

```bash
# 1. 用 npx 创建 uniapp 项目
npx degit dcloudio/uni-preset-vue#vite-ts sztu-icampus
cd sztu-icampus

# 2. 删掉默认生成的文件（我们用自己的）
rm -rf src/pages src/App.vue src/main.ts src/pages.json src/manifest.json
# Windows CMD:
# rmdir /s /q src\pages
# del src\App.vue src\main.ts src\pages.json src\manifest.json
```

## 第二步：安装依赖（1 分钟）

```bash
# 3. 安装核心依赖
pnpm add pinia pinia-plugin-persistedstate axios @uni-helper/axios-adapter tdesign-uniapp less

# ⚠️ 如果 pnpm 报错说版本冲突，用这个：
# pnpm add pinia pinia-plugin-persistedstate axios @uni-helper/axios-adapter tdesign-uniapp less --legacy-peer-deps
```

## 第三步：复制文件

文件按以下结构放进去（直接覆盖已有文件）：

```
项目根目录/
├── package.json          ← 覆盖（已经帮你写好依赖了，装完再覆盖的话要重新 pnpm install）
├── tsconfig.json         ← 覆盖（宽松的 TS 配置）
├── vite.config.ts        ← 覆盖（极简配置）
├── index.html            ← 覆盖
│
└── src/
    ├── env.d.ts          ← 新增（全局类型声明）
    ├── main.ts           ← 覆盖
    ├── App.vue           ← 覆盖（引入了 TDesign 主题样式）
    ├── pages.json        ← 覆盖（配了 easycom 让 TDesign 自动导入）
    ├── manifest.json     ← 覆盖
    ├── uni.scss          ← 覆盖
    │
    ├── utils/
    │   ├── storage.ts    ← 新增（缓存封装）
    │   ├── router.ts     ← 新增（路由守卫）
    │   └── http/
    │       └── index.ts  ← 新增（Axios 封装）
    │
    ├── api/
    │   ├── auth.ts       ← 新增（登录 API）
    │   └── types/
    │       └── auth.ts   ← 新增（类型定义）
    │
    ├── store/
    │   ├── index.ts      ← 新增
    │   └── modules/
    │       └── user.ts   ← 新增（用户 Store）
    │
    └── pages/
        ├── home/
        │   └── index.vue ← 新增（首页，有 TDesign 按钮测试）
        ├── login/
        │   └── index.vue ← 新增（登录页）
        └── schedule/
            └── index.vue ← 新增（课表页占位）
```

## 第四步：跑起来

```bash
# 编译到微信小程序
pnpm dev:mp-weixin
```

然后用微信开发者工具打开 `dist/dev/mp-weixin` 目录。

如果首页能看到 **TDesign 的蓝色按钮**，说明一切正常。


---

# 各文件的作用（地图）

| 文件 | 干什么的 | 什么时候改它 |
|------|---------|------------|
| `tsconfig.json` | TS 编译配置 | 想加严格检查时去掉注释 |
| `vite.config.ts` | 构建配置 | 基本不用动 |
| `pages.json` | 路由表 + TDesign easycom | 加新页面时改这里 |
| `App.vue` | 根组件 + 全局样式 | 加全局 CSS、App生命周期 |
| `main.ts` | 应用入口 | 注册新插件时改这里 |
| `utils/http/index.ts` | 请求封装 | 改 baseURL、调整错误处理 |
| `utils/storage.ts` | 缓存工具 | 基本不用改 |
| `utils/router.ts` | 路由守卫 | 加新的需要登录的页面 |
| `store/modules/user.ts` | 用户状态 | 改登录逻辑 |
| `api/auth.ts` | 登录接口 | 对接你的胶水层接口 |
| `api/types/auth.ts` | 类型定义 | 跟后端接口对齐 |

---

# TDesign 使用说明

## 为什么之前不生效？

TDesign 在 uniapp 中需要三个条件同时满足：

1. **安装正确的包**：是 `tdesign-uniapp`，不是 `tdesign-miniprogram`
2. **pages.json 配 easycom**：让编译器知道 `<t-button>` 去哪找
3. **App.vue 引入主题 CSS**：没有这行，组件有但没样式

这三步我都已经帮你配好了。

## 怎么用 TDesign 组件？

直接在 template 中写，**不需要 import，不需要注册**：

```vue
<template>
  <!-- 按钮 -->
  <t-button theme="primary">确定</t-button>
  <t-button theme="danger" variant="outline">删除</t-button>

  <!-- 输入框 -->
  <t-input v-model="name" label="姓名" placeholder="请输入" />

  <!-- 单元格列表 -->
  <t-cell-group>
    <t-cell title="课表" arrow />
    <t-cell title="设置" arrow />
  </t-cell-group>

  <!-- 空状态 -->
  <t-empty description="暂无数据" />

  <!-- 加载 -->
  <t-loading text="加载中..." />
</template>
```

easycom 的原理：编译时看到 `<t-button>`，自动去
`node_modules/tdesign-uniapp/button/button.vue` 找组件。

## 适配uniapp 的 TDesign 文档在哪查？

https://tdesign.tencent.com/uniapp/components/button

所有组件的属性、事件、用法都在这里。
