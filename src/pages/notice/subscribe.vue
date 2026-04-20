<!--
  订阅管理页面（source 级别）

  文件：src/pages/notice/subscribe.vue

  左侧：来源分类树（同 SourcePicker 结构）
  右侧：每个 source 有订阅开关
  订阅粒度到单个数据源（如 "中德学院·通知公告"）
-->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { infoApi } from '@/api/info-api'
import type { Channel, SourceInfo } from '@/types/info'
import { SOURCE_ORG_TREE } from '@/types/info'
import { useSubscriptionStore, MAX_SUBSCRIPTIONS } from '@/store/modules/subscription'

// ==================== 状态 ====================

const channels = ref<Channel[]>([])
const loading = ref(false)
const activeOrg = ref('')

const subscriptionStore = useSubscriptionStore()

// ==================== 计算属性 ====================

/** 按 sourceOrg 分组的频道（排除 fixed） */
const orgGroups = computed(() => {
  const groups: Record<string, Channel[]> = {}
  for (const ch of channels.value) {
    const org = ch.sourceOrg || 'unknown'
    if (org === 'fixed') continue
    if (!groups[org]) groups[org] = []
    groups[org].push(ch)
  }
  return groups
})

/** 当前选中分类下的所有 source（扁平列表） */
const displaySources = computed<Array<{ source: SourceInfo; channelName: string }>>(() => {
  const result: Array<{ source: SourceInfo; channelName: string }> = []

  const channelsToShow = activeOrg.value
    ? (orgGroups.value[activeOrg.value] || [])
    : channels.value.filter(ch => ch.sourceOrg !== 'fixed')

  for (const ch of channelsToShow) {
    if (ch.sources) {
      for (const src of ch.sources) {
        result.push({ source: src, channelName: ch.name })
      }
    }
  }
  return result
})

const subscribedCount = computed(() => subscriptionStore.count)

// 可展开的分类列表（排除 全部/已订阅/公文通）
const subscribableOrgs = computed(() =>
  SOURCE_ORG_TREE.filter(item =>
    item.value && item.value !== 'subscribed' && item.value !== 'fixed'
  )
)

// ==================== 方法 ====================

function toggleSubscribe(sourceId: string) {
  const result = subscriptionStore.toggle(sourceId)
  if (result === 'full') {
    uni.showToast({
      title: `订阅已达上限 ${MAX_SUBSCRIPTIONS} 个`,
      icon: 'none',
    })
  }
}

function isSubscribed(sourceId: string): boolean {
  return subscriptionStore.isSubscribed(sourceId)
}

function selectOrg(orgValue: string) {
  activeOrg.value = orgValue
}

/** source 的显示名称（频道名·source名） */
function getSourceLabel(channelName: string, source: SourceInfo): string {
  return `${channelName}·${source.name}`
}

// ==================== 生命周期 ====================

onMounted(async () => {
  loading.value = true
  try {
    const result = await infoApi.getChannels()
    channels.value = (result || []).filter((ch: any) => ch.sourceOrg !== 'fixed')
  } catch (e) {
    console.error('[Subscribe] 获取频道失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="subscribe-page">

    <view class="header-info">
      <text class="subscribed-count">已订阅 {{ subscribedCount }} / {{ MAX_SUBSCRIPTIONS }}</text>
      <text class="header-hint">订阅后在"已订阅"视图中聚合查看，推送也只提示订阅的源</text>
    </view>

    <!-- 主布局：左侧分类 + 右侧 source 列表 -->
    <view class="main-layout">

      <!-- 左侧分类 -->
      <scroll-view scroll-y class="sidebar">
        <view
          :class="['sidebar-item', { active: activeOrg === '' }]"
          @tap="selectOrg('')"
        >
          <text>全部</text>
        </view>
        <view
          v-for="item in subscribableOrgs"
          :key="item.value"
          :class="['sidebar-item', { active: activeOrg === item.value }]"
          @tap="selectOrg(item.value)"
        >
          <text>{{ item.label }}</text>
        </view>
      </scroll-view>

      <!-- 右侧 source 列表 -->
      <scroll-view scroll-y class="source-list">
        <view v-if="loading" class="loading-state">
          <t-loading theme="circular" size="60rpx" />
          <text>加载中...</text>
        </view>

        <view v-else-if="displaySources.length === 0" class="empty-state">
          <text>暂无数据源</text>
        </view>

        <view
          v-for="item in displaySources"
          :key="item.source.id"
          :class="['source-item', { subscribed: isSubscribed(item.source.id) }]"
          @tap="toggleSubscribe(item.source.id)"
        >
          <view class="source-info">
            <text class="source-name">{{ getSourceLabel(item.channelName, item.source) }}</text>
          </view>
          <t-icon
            :name="isSubscribed(item.source.id) ? 'check-circle-filled' : 'add-circle'"
            :size="'44rpx'"
            :color="isSubscribed(item.source.id) ? '#0052d9' : '#ccc'"
          />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.subscribe-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.header-info {
  padding: 20rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.subscribed-count {
  font-size: 28rpx;
  color: #0052d9;
  font-weight: 600;
}

.header-hint {
  font-size: 22rpx;
  color: #999;
}

.main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 200rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}

.sidebar-item {
  padding: 28rpx 24rpx;
  font-size: 26rpx;
  color: #333;
  border-left: 6rpx solid transparent;

  &.active {
    background: #fff;
    color: #0052d9;
    font-weight: 600;
    border-left-color: #0052d9;
  }
}

.source-list {
  flex: 1;
  background: #fff;
}

.source-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &.subscribed {
    background: #f8faff;
  }
}

.source-info {
  flex: 1;
  min-width: 0;
}

.source-name {
  font-size: 26rpx;
  color: #333;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
  gap: 16rpx;
  color: #999;
  font-size: 26rpx;
}
</style>
