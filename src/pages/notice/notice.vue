<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { checkTabAuth } from '@/utils/router'
import type { NoticeItem, NoticeType } from '@/types/notice'

onShow(() => checkTabAuth())

const activeTab = ref<NoticeType>('announcement')
const loading = ref(false)
const list = ref<NoticeItem[]>([])

const mockData: NoticeItem[] = [
  { id: '1', title: '关于2024年寒假放假安排的通知', type: 'announcement', date: '2024-01-15' },
  { id: '2', title: '图书馆开放时间调整通知', type: 'announcement', date: '2024-01-14' },
  { id: '3', title: '计算机学院学术讲座通知', type: 'department', department: '计算机学院', date: '2024-01-13' },
  { id: '4', title: '人工智能学院招生宣讲会', type: 'department', department: '人工智能学院', date: '2024-01-12' },
]

const fetchList = () => {
  loading.value = true
  setTimeout(() => {
    list.value = mockData.filter(item => item.type === activeTab.value)
    loading.value = false
  }, 300)
}

const handleTabChange = (type: NoticeType) => {
  activeTab.value = type
  fetchList()
}

const handleItemClick = (item: NoticeItem) => {
  uni.showToast({ title: `查看: ${item.title}`, icon: 'none' })
}

fetchList()
</script>

<template>
  <view class="notice-page">
    <t-tabs :value="activeTab" @change="handleTabChange">
      <t-tab-panel value="announcement" label="校园公告" />
      <t-tab-panel value="department" label="部门通知" />
    </t-tabs>

    <t-loading v-if="loading" class="loading" />

    <view v-else class="list">
      <t-cell v-for="item in list" :key="item.id" :title="item.title" :note="item.department || ''"
        :description="item.date" arrow @click="handleItemClick(item)" />
      <t-empty v-if="!list.length" description="暂无内容" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.notice-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.loading {
  padding: 100rpx 0;
  text-align: center;
}

.list {
  padding: 20rpx;
}
</style>