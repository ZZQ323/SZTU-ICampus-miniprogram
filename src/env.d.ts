/// <reference types="@dcloudio/types" />

// 让 TypeScript 认识 .vue 文件
declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 让 TypeScript 认识 uni 的条件编译注释（#ifdef 等）
// 这样 TS 不会报 "Unknown word" 的错
