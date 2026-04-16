<!--
  内嵌网页页面

  文件：src/pages/common/webview/webview.vue

  用于打开微信公众号文章等可在小程序内访问的外链。
  通过 URL 参数传入目标链接：
  /pages/common/webview/webview?url=https://mp.weixin.qq.com/s/xxxxx
-->

<template>
  <web-view :src="url" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const url = ref('')

onLoad((options) => {
  if (options?.url) {
    url.value = decodeURIComponent(options.url)
  }
})
</script>
