<!--
  信息流页面（三维筛选版）

  文件：src/pages/notice/notice.vue

  布局：
  1. 信息来源选择器（左上角下拉）
  2. 双层 Tab（大类 + 细分类）
  3. 搜索框
  4. 文章列表（带来源标注）
  5. 右上角订阅编辑按钮（navigationBar）
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import InfoListItem from '@/components/info/InfoListItem.vue'
import SourcePicker from '@/components/info/SourcePicker.vue'
import { useUserStore } from '@/store/modules/user'
import { useInfoStore } from '@/store/modules/info'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { infoApi } from '@/api/info-api'
import type { InfoItemMeta, Channel } from '@/types/info'
import { TAB_LAYER1, TAB_LAYER2_NEWS, TAB_LAYER2_NOTICE, CATEGORY_LIST } from '@/types/info'

const userStore = useUserStore()
const infoStore = useInfoStore()
const { ensure, isReady } = useAuthGuard()

// ==================== 筛选状态 ====================

/** 信息来源选择 */
const sourceFilter = ref<{ sourceOrg?: string; channelId?: string; label: string }>({
  label: '全部来源'
})
const showSourcePicker = ref(false)

/** 第一层 Tab */
const activeLayer1 = ref('')
/** 第二层 Tab */
const activeLayer2 = ref('')

/** 频道列表缓存 */
const channels = ref<Channel[]>([])

// ==================== 列表状态 ====================

const loading = ref(false)
const refreshing = ref(false)
const list = ref<InfoItemMeta[]>([])
const page = ref(1)
const hasMore = ref(true)
const searchKeyword = ref('')
const isSearchMode = ref(false)

// ==================== 计算属性 ====================

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)

/** 是否选中了公文通 */
const isAnnouncement = computed(() => sourceFilter.value.channelId === 'announcement')

/** 第二层 Tab 列表（随第一层变化） */
const layer2Tabs = computed(() => {
  if (activeLayer1.value === 'news') return TAB_LAYER2_NEWS
  if (activeLayer1.value === 'notice') return TAB_LAYER2_NOTICE
  return []
})

/** 是否显示第二层 Tab */
const showLayer2 = computed(() => activeLayer1.value !== '' && !isAnnouncement.value)

/** 是否显示公文通分类 pills */
const showGwtCategories = computed(() => isAnnouncement.value)

// ==================== 方法 ====================

async function fetchList(reset = false) {
  if (reset) {
    page.value = 1
    hasMore.value = true
    isSearchMode.value = false
  }
  if (!hasMore.value && !reset) return
  loading.value = true

  try {
    let result: any

    if (isAnnouncement.value) {
      // 公文通走原有的 list API（需要登录）
      result = await infoApi.getList({
        channelId: 'announcement',
        categoryCode: activeLayer2.value || undefined,
        page: page.value,
        pageSize: 20
      })
    } else {
      // 其他来源走全局 feed API
      result = await infoApi.getFeed({
        sourceOrg: sourceFilter.value.sourceOrg || undefined,
        channelId: sourceFilter.value.channelId || undefined,
        contentType: activeLayer1.value || undefined,
        subContentType: activeLayer2.value || undefined,
        page: page.value,
        pageSize: 20
      })
    }

    const items = result.items || []
    if (reset) {
      list.value = items
    } else {
      list.value = [...list.value, ...items]
    }
    hasMore.value = result.hasMore

  } catch (e) {
    console.error('[Notice] 获取列表失败', e)
    if (reset) list.value = []
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function handleSourceSelect(payload: { sourceOrg?: string; channelId?: string; label: string }) {
  sourceFilter.value = payload
  // 切换来源时重置 Tab
  activeLayer1.value = ''
  activeLayer2.value = ''
  fetchList(true)
}

function handleLayer1Change(value: string) {
  activeLayer1.value = value
  activeLayer2.value = '' // 重置第二层
  fetchList(true)
}

function handleLayer2Change(value: string) {
  activeLayer2.value = value
  fetchList(true)
}

function handleCategoryChange(categoryCode: string) {
  // 公文通分类
  activeLayer2.value = categoryCode
  fetchList(true)
}

function onSearchInputChanged(context: { value: string }) {
  searchKeyword.value = context.value
}

async function handleSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return
  loading.value = true
  isSearchMode.value = true
  hasMore.value = false

  try {
    const channelId = sourceFilter.value.channelId || undefined
    const result = await infoApi.search(keyword, channelId, 50)
    list.value = result || []
  } catch (e) {
    console.error('[Notice] 搜索失败', e)
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
  if (item.extra && item.extra.includes('"external"')) {
    uni.setClipboardData({
      data: item.url,
      success: () => uni.showToast({ title: '链接已复制', icon: 'success' })
    })
    return
  }

  // ⭐ 缓存当前列表到 storage，供 detail.vue 实现上一篇/下一篇导航
  const navList = list.value.map(i => ({
    id: i.id,
    title: i.title,
    channelId: i.channelId || 'announcement',
    categoryCode: i.categoryCode || '',
  }))
  uni.setStorageSync('detail_nav_list', JSON.stringify(navList))

  const channelId = item.channelId || 'announcement'
  uni.navigateTo({
    url: `/pages/notice/detail?id=${item.id}&channelId=${channelId}&category=${item.categoryCode || ''}`
  })
}

function openSubscribePage() {
  uni.navigateTo({ url: '/pages/notice/subscribe' })
}

async function handleRefresh() {
  refreshing.value = true
  searchKeyword.value = ''
  isSearchMode.value = false
  await fetchList(true)
}

/** 加载频道列表（用于 SourcePicker） */
async function loadChannels() {
  if (channels.value.length > 0) return
  try {
    const result = await infoApi.getChannels()
    channels.value = result || []
  } catch { /* ignore */ }
}

// ==================== 生命周期 ====================

onShow(async () => {
  await ensure({ requireSchoolLogin: false })
  if (!isSearchMode.value) fetchList(true)
  loadChannels()
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

      <!-- 信息来源选择器 -->
      <view class="source-selector" @tap="showSourcePicker = true">
        <t-icon name="view-list" size="32rpx" color="#0052d9" />
        <text class="source-label">{{ sourceFilter.label }}</text>
        <t-icon name="chevron-down" size="28rpx" color="#999" />
      </view>

      <!-- 第一层 Tab：内容大类 -->
      <view v-if="!isAnnouncement" class="tab-bar">
        <view
          v-for="tab in TAB_LAYER1"
          :key="tab.value"
          :class="['tab-item', { active: activeLayer1 === tab.value }]"
          @tap="handleLayer1Change(tab.value)"
        >{{ tab.label }}</view>
      </view>

      <!-- 第二层 Tab：细分类（随大类变化） -->
      <scroll-view v-if="showLayer2" scroll-x class="tab-bar-scroll" :show-scrollbar="false">
        <view class="tab-bar sub">
          <view
            v-for="tab in layer2Tabs"
            :key="tab.value"
            :class="['tab-item sub', { active: activeLayer2 === tab.value }]"
            @tap="handleLayer2Change(tab.value)"
          >{{ tab.label }}</view>
        </view>
      </scroll-view>

      <!-- 公文通分类 pills -->
      <scroll-view v-if="showGwtCategories" scroll-x class="category-scroll" :show-scrollbar="false">
        <view class="category-list">
          <view
            v-for="cat in CATEGORY_LIST"
            :key="cat.code"
            :class="['category-item', { active: activeLayer2 === cat.code }]"
            @click="handleCategoryChange(cat.code)"
          >{{ cat.name }}</view>
        </view>
      </scroll-view>

      <!-- 搜索框 -->
      <view class="search-header">
        <view class="search-box">
          <t-input :value="searchKeyword" placeholder="搜索标题..." clearable
            @change="onSearchInputChanged" @confirm="handleSearch" @clear="handleClearSearch">
            <template #prefix-icon>
              <t-icon name="search" size="40rpx" />
            </template>
          </t-input>
        </view>
        <t-button class="search-btn" @click="handleSearch">
          <text>搜索</text>
        </t-button>
      </view>

      <!-- 搜索模式提示 -->
      <view v-if="isSearchMode" class="search-mode-tip">
        <text>搜索结果：{{ list.length }} 条</text>
        <view class="clear-search" @click="handleClearSearch">
          <t-icon name="close" size="28rpx" />
          <text>清除搜索</text>
        </view>
      </view>

      <!-- 未登录提示（仅公文通需要） -->
      <view v-if="isAnnouncement && !isLoggedIn" class="login-tip">
        <t-icon name="info-circle" size="32rpx" />
        <text>登录后可查看公文通内容</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading && list.length === 0" class="loading-wrap">
        <t-loading theme="circular" size="80rpx" />
        <text class="loading-text">加载中...</text>
      </view>

      <!-- 列表 -->
      <view v-else class="list">
        <InfoListItem
          v-for="item in list"
          :key="(item.channelId || '') + ':' + item.id"
          :item="item"
          @tap="handleItemClick(item)"
        />

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

    <!-- 信息来源弹窗 -->
    <SourcePicker
      :visible="showSourcePicker"
      :channels="channels"
      @select="handleSourceSelect"
      @close="showSourcePicker = false"
    />

    <!-- 回到顶部 -->
    <t-back-top />
  </PageLayout>
</template>

<style lang="scss" scoped>
.notice-page {
  min-height: 100vh;
  background: #f5f5f5;
}

/* 信息来源选择器 */
.source-selector {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 20rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.source-label {
  font-size: 30rpx;
  font-weight: 500;
  color: #0052d9;
}

/* Tab 栏 */
.tab-bar {
  display: flex;
  background: #fff;
  border-bottom: 1rpx solid #eee;

  &.sub {
    display: inline-flex;
    min-width: 100%;
    border-bottom: none;
  }
}

.tab-bar-scroll {
  background: #fff;
  border-bottom: 1rpx solid #eee;
  white-space: nowrap;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
  transition: color 0.2s;

  &.sub {
    flex: none;
    padding: 20rpx 28rpx;
    font-size: 26rpx;
  }

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

/* 公文通分类 */
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

/* 搜索 */
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
