<!--
  信息流页面（动态频道 + 独立订阅页版）

  文件：src/pages/notice/notice.vue

  ⭐ 改动：
  1. Tab 列表从 DEFAULT_TABS + 用户订阅动态生成
  2. "+" 按钮跳转到独立的订阅管理页面 (subscribe.vue)
  3. channelId 从 Tab 选择传入
  4. 分类 pills 仅在公告频道显示
  5. 搜索、详情跳转、标记已读均使用当前 channelId
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import InfoListItem from '@/components/info/InfoListItem.vue'
import { useUserStore } from '@/store/modules/user'
import { useInfoStore } from '@/store/modules/info'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { infoApi } from '@/api/info-api'
import type { InfoItemMeta, Channel, ChannelTab } from '@/types/info'
import { CATEGORY_LIST } from '@/types/info'

const userStore = useUserStore()
const infoStore = useInfoStore()
const { ensure, isReady } = useAuthGuard()

// ==================== 频道配置 ====================

/** 固定频道（始终显示，sourceOrg=fixed，不可退订） */
const DEFAULT_TABS: ChannelTab[] = [
  { id: 'announcement', name: '公文通', hasCategories: true },
]

const STORAGE_KEY = 'icampus_subscribed_channels'

// ==================== 订阅状态 ====================

/** 用户额外订阅的频道 ID 列表 */
const subscribedIds = ref<string[]>(loadSubscribedIds())
/** 后端频道列表缓存（用于将 id 映射为 name） */
const channelCache = ref<Channel[]>([])

function loadSubscribedIds(): string[] {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/** 当前显示的 Tab 列表（默认 + 已订阅） */
const displayTabs = computed<ChannelTab[]>(() => {
  const extra = subscribedIds.value
    .map(id => channelCache.value.find(ch => ch.id === id))
    .filter((ch): ch is Channel => !!ch)
    .map(ch => ({ id: ch.id, name: ch.name, hasCategories: false } as ChannelTab))
  return [...DEFAULT_TABS, ...extra]
})

/** 跳转到订阅管理页 */
function openSubscribePage() {
  uni.navigateTo({ url: '/pages/notice/subscribe' })
}

/** 刷新订阅状态（从 subscribe 页面返回时） */
function refreshSubscriptions() {
  subscribedIds.value = loadSubscribedIds()
}

/** 拉取频道列表用于 Tab 名称映射 */
async function fetchChannelNames() {
  if (channelCache.value.length > 0) return
  try {
    const channels = await infoApi.getChannels()
    channelCache.value = (channels || []).filter(
      (ch: any) => ch.sourceOrg && ch.sourceOrg !== 'fixed'
    )
  } catch { /* ignore */ }
}

// ==================== 状态 ====================

const loading = ref(false)
const refreshing = ref(false)
const list = ref<InfoItemMeta[]>([])
const page = ref(1)
const hasMore = ref(true)
const latestId = ref('0')
const activeChannel = ref('announcement')
const activeCategory = ref('')
const searchKeyword = ref('')
const isSearchMode = ref(false)

// ==================== 计算属性 ====================

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)

const showCategories = computed(() => {
  const ch = displayTabs.value.find(c => c.id === activeChannel.value)
  return ch?.hasCategories ?? false
})

// ==================== Mock 数据 ====================

const mockData: InfoItemMeta[] = [
  {
    id: '50731', url: '', title: '关于2025年春季学期教学安排的通知',
    categoryCode: '1018', categoryName: '教务', department: '教务处',
    publishDate: '2025-01-15', channelId: 'announcement',
  },
  {
    id: '50730', url: '', title: '关于春节假期值班安排的通知',
    categoryCode: '1020', categoryName: '行政', department: '党政办公室',
    publishDate: '2025-01-14', channelId: 'announcement',
  },
]

// ==================== 方法 ====================

async function fetchList(reset = false) {
  if (!isLoggedIn.value) {
    list.value = filterByCategory(mockData)
    return
  }

  if (reset) {
    page.value = 1
    hasMore.value = true
    isSearchMode.value = false
  }

  if (!hasMore.value && !reset) return
  loading.value = true

  try {
    const result = await infoApi.getList({
      channelId: activeChannel.value,
      categoryCode: activeCategory.value || undefined,
      page: page.value,
      pageSize: 20
    })

    const items = (result.items || []).map(item => ({
      ...item,
      channelId: activeChannel.value,
    }))

    if (reset) {
      list.value = items
    } else {
      list.value = [...list.value, ...items]
    }

    latestId.value = result.latestId || '0'
    hasMore.value = result.hasMore

    if (result.latestId) {
      infoStore.updateServerLatestId(activeChannel.value, result.latestId)
    }
  } catch (e) {
    console.error('[Notice] 获取列表失败', e)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function filterByCategory(data: InfoItemMeta[]): InfoItemMeta[] {
  if (!activeCategory.value) return data
  return data.filter(item => item.categoryCode === activeCategory.value)
}

function handleChannelChange(channelId: string) {
  if (activeChannel.value === channelId) return
  activeChannel.value = channelId
  activeCategory.value = ''
  searchKeyword.value = ''
  isSearchMode.value = false
  fetchList(true)
}

function handleCategoryChange(categoryCode: string) {
  activeCategory.value = categoryCode
  searchKeyword.value = ''
  isSearchMode.value = false
  fetchList(true)
}

function onSearchInputChanged(context: { value: string }) {
  searchKeyword.value = context.value
}

async function handleSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return
  if (!isLoggedIn.value) {
    list.value = mockData.filter(item => item.title.includes(keyword))
    isSearchMode.value = true
    return
  }

  loading.value = true
  isSearchMode.value = true
  hasMore.value = false

  try {
    const result = await infoApi.search(keyword, activeChannel.value, 50)
    list.value = result.map(item => ({
      ...item,
      channelId: activeChannel.value,
    }))
  } catch (e) {
    console.error('[Notice] 搜索失败', e)
    uni.showToast({ title: '搜索失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

function handleClearSearch() {
  searchKeyword.value = ''
  isSearchMode.value = false
  fetchList(true)
}

function handleItemClick(item: InfoItemMeta) {
  // 外链文章：复制链接
  if (item.extra && item.extra.includes('"external"')) {
    uni.setClipboardData({
      data: item.url,
      success: () => uni.showToast({ title: '链接已复制', icon: 'success' })
    })
    return
  }

  // 站内文章：跳转详情页
  uni.navigateTo({
    url: `/pages/notice/detail?id=${item.id}&channelId=${item.channelId || activeChannel.value}&category=${item.categoryCode || ''}`
  })
}

async function handleRefresh() {
  refreshing.value = true
  searchKeyword.value = ''
  isSearchMode.value = false
  await fetchList(true)
}

// ==================== 生命周期 ====================

onShow(async () => {
  await ensure({ requireSchoolLogin: false })
  // 刷新订阅状态（可能从 subscribe 页面返回）
  refreshSubscriptions()
  // 拉取频道名称（用于 Tab 映射）
  if (subscribedIds.value.length > 0) fetchChannelNames()
  if (!isSearchMode.value) fetchList(true)
  if (isLoggedIn.value) infoStore.markChannelRead(activeChannel.value)
})

onReachBottom(() => {
  if (!loading.value && hasMore.value && !isSearchMode.value) {
    page.value++
    fetchList()
  }
})

onPullDownRefresh(() => {
  handleRefresh().finally(() => uni.stopPullDownRefresh())
})
</script>

<template>
  <PageLayout>
    <view v-if="isReady" class="notice-page">

      <!-- 频道 Tab（可横向滚动） -->
      <scroll-view scroll-x class="channel-tabs-scroll" :show-scrollbar="false">
        <view class="channel-tabs">
          <view v-for="ch in displayTabs" :key="ch.id"
            :class="['channel-tab', { active: activeChannel === ch.id }]"
            @tap="handleChannelChange(ch.id)">
            {{ ch.name }}
            <view v-if="infoStore.getUnreadCount(ch.id) > 0" class="unread-dot" />
          </view>
          <!-- "+" 按钮：跳转订阅管理页 -->
          <view class="channel-tab add-tab" @tap="openSubscribePage">
            <text class="add-icon">+</text>
          </view>
        </view>
      </scroll-view>

      <!-- 搜索框 -->
      <view class="search-header">
        <view class="search-box">
          <t-input :value="searchKeyword" placeholder="搜索标题..." clearable @change="onSearchInputChanged"
            @confirm="handleSearch" @clear="handleClearSearch">
            <template #prefix-icon>
              <t-icon name="search" size="40rpx" />
            </template>
          </t-input>
        </view>
        <t-button class="search-btn" @click="handleSearch">
          <text>搜索</text>
        </t-button>
      </view>

      <!-- 分类标签（仅公告频道） -->
      <scroll-view v-if="showCategories" scroll-x class="category-scroll" :show-scrollbar="false">
        <view class="category-list">
          <view v-for="cat in CATEGORY_LIST" :key="cat.code"
            :class="['category-item', { active: activeCategory === cat.code }]" @click="handleCategoryChange(cat.code)">
            {{ cat.name }}
          </view>
        </view>
      </scroll-view>

      <!-- 搜索模式提示 -->
      <view v-if="isSearchMode" class="search-mode-tip">
        <text>搜索结果：{{ list.length }} 条</text>
        <view class="clear-search" @click="handleClearSearch">
          <t-icon name="close" size="28rpx" />
          <text>清除搜索</text>
        </view>
      </view>

      <!-- 未登录提示 -->
      <view v-if="!isLoggedIn" class="login-tip">
        <t-icon name="info-circle" size="32rpx" />
        <text>登录后可查看最新内容</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading && list.length === 0" class="loading-wrap">
        <t-loading theme="circular" size="80rpx" />
        <text class="loading-text">加载中...</text>
      </view>

      <!-- 列表 -->
      <view v-else class="list">
        <InfoListItem v-for="item in list" :key="item.id" :item="item" @tap="handleItemClick(item)" />

        <view v-if="loading && list.length > 0" class="load-more">
          <t-loading theme="circular" size="40rpx" />
          <text>加载中...</text>
        </view>

        <view v-if="!hasMore && list.length > 0 && !isSearchMode" class="no-more">
          —— 没有更多了 ——
        </view>

        <t-empty v-if="!loading && list.length === 0" :description="isSearchMode ? '未找到相关内容' : '暂无内容'" />
      </view>
    </view>

  </PageLayout>
</template>

<style lang="scss" scoped>
.notice-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.channel-tabs-scroll {
  background: #fff;
  border-bottom: 1rpx solid #eee;
  white-space: nowrap;
}

.channel-tabs {
  display: inline-flex;
  min-width: 100%;
}

.channel-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 32rpx;
  font-size: 28rpx;
  color: #666;
  position: relative;
  transition: color 0.2s;
  flex-shrink: 0;

  &.active {
    color: #0052d9;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 48rpx;
      height: 4rpx;
      background: #0052d9;
      border-radius: 2rpx;
    }
  }
}

.add-tab {
  color: #999;
  padding: 24rpx 28rpx;
}

.add-icon {
  font-size: 36rpx;
  font-weight: 300;
}

.unread-dot {
  position: absolute;
  top: 16rpx;
  right: 12rpx;
  width: 12rpx;
  height: 12rpx;
  background: #fa5151;
  border-radius: 50%;
}


.search-header {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  background: #fff;
  gap: 16rpx;
}

.search-box {
  flex: 1;
}

.search-btn {
  padding: 16rpx 24rpx;
  background: #0052d9;
  color: #fff;
  border-radius: 8rpx;
  font-size: 26rpx;
}

.category-scroll {
  background: #fff;
  border-bottom: 1rpx solid #eee;
  white-space: nowrap;
}

.category-list {
  display: inline-flex;
  padding: 16rpx 24rpx;
  gap: 16rpx;
}

.category-item {
  display: inline-block;
  padding: 12rpx 28rpx;
  font-size: 26rpx;
  color: #666;
  background: #f5f5f5;
  border-radius: 32rpx;
  transition: all 0.2s;

  &.active {
    color: #fff;
    background: #0052d9;
  }
}

.search-mode-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  background: #e6f4ff;
  font-size: 24rpx;
  color: #0052d9;
}

.clear-search {
  display: flex;
  align-items: center;
  gap: 4rpx;
  color: #666;
}

.login-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx;
  background: #fff3e0;
  color: #f57c00;
  font-size: 24rpx;
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.loading-text {
  margin-top: 20rpx;
  color: #999;
  font-size: 26rpx;
}

.list {
  padding: 20rpx;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 32rpx;
  color: #999;
  font-size: 24rpx;
}

.no-more {
  text-align: center;
  padding: 32rpx;
  color: #ccc;
  font-size: 24rpx;
}
</style>