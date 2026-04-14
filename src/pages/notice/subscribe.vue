<!--
  订阅管理页面

  文件：src/pages/notice/subscribe.vue

  双维度浏览：
  - 按来源（职能部门/教辅科研/群团招就/学院）
  - 按内容（通知公告/新闻动态/学术科研/招生就业/校园活动/党建工作）
  左侧 SideBar + 右侧频道列表 + 订阅切换
-->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { infoApi } from '@/api/info-api'
import type { Channel } from '@/types/info'
import { SOURCE_ORG_LIST, CONTENT_TYPE_LIST } from '@/types/info'
import { extractString } from '@/utils/tdesign'

// ==================== 常量 ====================

const STORAGE_KEY = 'icampus_subscribed_channels'

// ==================== 状态 ====================

/** 维度模式：source=按来源, content=按内容 */
const dimension = ref<'source' | 'content'>('source')
/** SideBar 当前选中分类 */
const activeCategory = ref('')
/** 所有可订阅频道（sourceOrg !== 'fixed'） */
const channels = ref<Channel[]>([])
/** 用户已订阅的频道 ID */
const subscribedIds = ref<string[]>(loadSubscribedIds())
/** 加载中 */
const loading = ref(false)

// ==================== 计算属性 ====================

/** 当前 SideBar 的分类列表 */
const sidebarItems = computed(() =>
  dimension.value === 'source' ? SOURCE_ORG_LIST : CONTENT_TYPE_LIST
)

/** 按当前维度和分类过滤后的频道 */
const filteredChannels = computed(() => {
  const cat = activeCategory.value
  if (!cat) return channels.value  // 全部

  if (dimension.value === 'source') {
    return channels.value.filter(ch => ch.sourceOrg === cat)
  } else {
    return channels.value.filter(ch =>
      ch.contentTypes && ch.contentTypes.includes(cat)
    )
  }
})

/** 已订阅数量 */
const subscribedCount = computed(() => subscribedIds.value.length)

// ==================== 方法 ====================

function loadSubscribedIds(): string[] {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSubscribedIds() {
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(subscribedIds.value))
}

function toggleSubscribe(channelId: string) {
  const idx = subscribedIds.value.indexOf(channelId)
  if (idx >= 0) {
    subscribedIds.value.splice(idx, 1)
  } else {
    subscribedIds.value.push(channelId)
  }
  saveSubscribedIds()
}

function isSubscribed(channelId: string): boolean {
  return subscribedIds.value.includes(channelId)
}

function switchDimension(dim: 'source' | 'content') {
  dimension.value = dim
  activeCategory.value = ''  // 重置分类
}

function handleSideBarChange(e: any) {
  activeCategory.value = extractString(e)
}

// ==================== 生命周期 ====================

onMounted(async () => {
  loading.value = true
  try {
    const allChannels = await infoApi.getChannels()
    channels.value = (allChannels || []).filter(
      (ch: any) => ch.sourceOrg && ch.sourceOrg !== 'fixed'
    )
  } catch (e) {
    console.error('[Subscribe] 获取频道列表失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="subscribe-page">

    <!-- 顶部信息 -->
    <view class="header-info">
      <text class="subscribed-count">已订阅 {{ subscribedCount }} 个频道</text>
    </view>

    <!-- 维度切换 Tab -->
    <view class="dimension-tabs">
      <view
        :class="['dim-tab', { active: dimension === 'source' }]"
        @tap="switchDimension('source')"
      >按来源</view>
      <view
        :class="['dim-tab', { active: dimension === 'content' }]"
        @tap="switchDimension('content')"
      >按内容</view>
    </view>

    <!-- SideBar + 频道列表 -->
    <view class="main-layout">
      <!-- 左侧 SideBar -->
      <scroll-view scroll-y class="sidebar">
        <view
          v-for="item in sidebarItems"
          :key="item.value"
          :class="['sidebar-item', { active: activeCategory === item.value }]"
          @tap="activeCategory = item.value"
        >
          <text>{{ item.label }}</text>
        </view>
      </scroll-view>

      <!-- 右侧频道列表 -->
      <scroll-view scroll-y class="channel-list">
        <view v-if="loading" class="loading-state">
          <t-loading theme="circular" size="60rpx" />
          <text>加载中...</text>
        </view>

        <view v-else-if="filteredChannels.length === 0" class="empty-state">
          <text>暂无频道</text>
        </view>

        <view
          v-for="ch in filteredChannels"
          :key="ch.id"
          :class="['channel-item', { subscribed: isSubscribed(ch.id) }]"
          @tap="toggleSubscribe(ch.id)"
        >
          <view class="channel-info">
            <text class="channel-name">{{ ch.name }}</text>
            <text v-if="ch.description" class="channel-desc">{{ ch.description }}</text>
          </view>
          <view class="subscribe-toggle">
            <t-icon
              :name="isSubscribed(ch.id) ? 'check-circle-filled' : 'add-circle'"
              :size="'44rpx'"
              :color="isSubscribed(ch.id) ? '#0052d9' : '#ccc'"
            />
          </view>
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
}

.subscribed-count {
  font-size: 26rpx;
  color: #999;
}

/* 维度切换 */
.dimension-tabs {
  display: flex;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.dim-tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
  transition: color 0.2s;

  &.active {
    color: #0052d9;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 64rpx;
      height: 4rpx;
      background: #0052d9;
      border-radius: 2rpx;
    }
  }
}

/* 主布局：左右分栏 */
.main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧 SideBar */
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
  transition: all 0.2s;

  &.active {
    background: #fff;
    color: #0052d9;
    font-weight: 600;
    border-left-color: #0052d9;
  }
}

/* 右侧频道列表 */
.channel-list {
  flex: 1;
  background: #fff;
}

.channel-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
  transition: background 0.2s;

  &.subscribed {
    background: #f8faff;
  }
}

.channel-info {
  flex: 1;
  min-width: 0;
}

.channel-name {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.channel-desc {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscribe-toggle {
  flex-shrink: 0;
  padding-left: 16rpx;
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
