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
import { onShow, onHide, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import InfoListItem from '@/components/info/InfoListItem.vue'
import SourcePicker from '@/components/info/SourcePicker.vue'
import FilterDrawer from '@/components/info/FilterDrawer.vue'
import { useUserStore } from '@/store/modules/user'
import { useInfoStore } from '@/store/modules/info'
import { useSubscriptionStore } from '@/store/modules/subscription'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { infoApi } from '@/api/info-api'
import { academicApi } from '@/api/auth-apis'
import type { InfoItemMeta, Channel } from '@/types/info'
import { TAB_LAYER1, TAB_LAYER2_NEWS, TAB_LAYER2_NOTICE, CATEGORY_LIST } from '@/types/info'

/** 教务内网的固定频道 id — 依赖 jwxt cookies，可触发 initAcademic 自愈 */
const ACDM_CHANNELS = new Set(['acdm-notice', 'acdm-message'])

const userStore = useUserStore()
const infoStore = useInfoStore()
const subscriptionStore = useSubscriptionStore()
const { ensure, isReady } = useAuthGuard()

/** 已订阅视图上限（和 store 的 MAX_SUBSCRIPTIONS 是两回事：这是 feed 一次返回的条数） */
const SUBSCRIBED_FEED_LIMIT = 20

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

/** 是否是某个教务内网固定频道（需登录、需 jwxt cookies） */
const isFixedChannel = computed(() => {
  const c = sourceFilter.value.channelId
  return c === 'announcement' || ACDM_CHANNELS.has(c || '')
})

/** 是否选中了公文通（独有分类 pills） */
const isAnnouncement = computed(() => sourceFilter.value.channelId === 'announcement')

/** 是否选中了教务 inbox 类频道（空态可触发 initAcademic） */
const isAcdmChannel = computed(() => ACDM_CHANNELS.has(sourceFilter.value.channelId || ''))

/** 是否选中了"已订阅"视图 */
const isSubscribedMode = computed(() => sourceFilter.value.sourceOrg === 'subscribed')

/** init 教务正在进行中（按钮 loading 态） */
const acdmIniting = ref(false)

/** 临时筛选（仅在已订阅视图有效）：null = 未筛选 = 显示全部已订阅 */
const tempFilterIds = ref<string[] | null>(null)
const showFilterDrawer = ref(false)

/** 第二层 Tab 列表（随第一层变化） */
const layer2Tabs = computed(() => {
  if (activeLayer1.value === 'news') return TAB_LAYER2_NEWS
  if (activeLayer1.value === 'notice') return TAB_LAYER2_NOTICE
  return []
})

/** 是否显示第二层 Tab */
const showLayer2 = computed(() => activeLayer1.value !== '' && !isFixedChannel.value && !isSubscribedMode.value)

/** 是否显示公文通分类 pills（只有 announcement 有教务/科研/行政... 这些子分类） */
const showGwtCategories = computed(() => isAnnouncement.value)

/** 已订阅视图是否应该显示"筛选"按钮（有订阅内容时才有意义） */
const canFilter = computed(() => isSubscribedMode.value && subscriptionStore.count > 0)

/** 当前生效的 source 白名单（已订阅视图下） */
const effectiveSourceIds = computed<string[]>(() =>
  tempFilterIds.value ?? subscriptionStore.subscribedIds
)

/** 临时筛选是否处于激活状态 */
const isTempFilterActive = computed(() => tempFilterIds.value !== null)

// ==================== 方法 ====================

async function fetchList(reset = false) {
  if (reset) {
    page.value = 1
    hasMore.value = true
    isSearchMode.value = false
  }
  if (!hasMore.value && !reset) return

  // 已订阅模式且订阅集为空 → 清空列表，不发请求
  if (isSubscribedMode.value && subscriptionStore.count === 0) {
    list.value = []
    hasMore.value = false
    loading.value = false
    refreshing.value = false
    return
  }

  loading.value = true

  try {
    let result: any

    if (isSubscribedMode.value) {
      // 已订阅视图：走 feed API，用 sourceIds 白名单；历史只给 20 条（重在推送）
      result = await infoApi.getFeed({
        sourceIds: effectiveSourceIds.value.join(','),
        pageSize: SUBSCRIBED_FEED_LIMIT,
        page: 1,
      })
      // 订阅视图不分页
      hasMore.value = false
    } else if (isFixedChannel.value) {
      // 教务内网组（公文通 / 已收公告 / 消息通知）走 list API（需要登录）
      // categoryCode 只对 announcement 有意义（教务/科研/行政...）
      result = await infoApi.getList({
        channelId: sourceFilter.value.channelId!,
        categoryCode: isAnnouncement.value ? (activeLayer2.value || undefined) : undefined,
        page: page.value,
        pageSize: 20
      })
      hasMore.value = result.hasMore
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
      hasMore.value = result.hasMore
    }

    const items = result.items || []
    if (reset) {
      list.value = items
    } else {
      list.value = [...list.value, ...items]
    }

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
  // 切换来源时重置 Tab + 临时筛选
  activeLayer1.value = ''
  activeLayer2.value = ''
  tempFilterIds.value = null
  fetchList(true)
}

function openFilterDrawer() {
  if (!canFilter.value) return
  showFilterDrawer.value = true
}

function handleFilterApply(ids: string[]) {
  // 若等价于全选则视为未筛选
  const subSet = new Set(subscriptionStore.subscribedIds)
  const picked = new Set(ids)
  const allSubscribed = picked.size === subSet.size && [...subSet].every(id => picked.has(id))
  tempFilterIds.value = allSubscribed ? null : ids
  fetchList(true)
}

function handleFilterClear() {
  tempFilterIds.value = null
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

// 防抖：华为/小米等真机 @tap 偶尔触发两次，detail 页会被推入栈两次
let lastItemClickAt = 0
function handleItemClick(item: InfoItemMeta) {
  const now = Date.now()
  if (now - lastItemClickAt < 400) return
  lastItemClickAt = now

  if (item.extra && item.extra.includes('"external"')) {
    // 提取外链 URL（去掉 EXTERNAL: 前缀）
    const externalUrl = item.url?.replace(/^EXTERNAL:/, '') || ''

    if (externalUrl.includes('mp.weixin.qq.com')) {
      // 微信公众号文章 → 小程序内 web-view 打开
      uni.navigateTo({
        url: `/pages/common/webview/webview?url=${encodeURIComponent(externalUrl)}`
      })
    } else {
      // 其他外链 → 复制链接
      uni.setClipboardData({
        data: externalUrl,
        success: () => uni.showToast({ title: '链接已复制', icon: 'success' })
      })
    }
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

/** acdm 频道空态兜底：用户手动触发教务初始化 → 成功后重新拉列表 */
async function handleInitAcdm() {
  if (acdmIniting.value) return
  acdmIniting.value = true
  try {
    await academicApi.initAcademic()
    uni.showToast({ title: '已初始化，刷新中...', icon: 'success' })
    // 后端异步爬取，稍等一会再拉 —— 2s 通常够 acdm-* 跑完首页
    setTimeout(() => fetchList(true), 2000)
  } catch (e: any) {
    uni.showModal({
      title: '初始化失败',
      content: e?.message || '网络不稳定，请稍后再试或去"首页"点击"刷新会话"。',
      showCancel: false
    })
  } finally {
    acdmIniting.value = false
  }
}

/** 加载频道列表（用于 SourcePicker） */
async function loadChannels() {
  if (channels.value.length > 0) return
  try {
    const result = await infoApi.getChannels()
    channels.value = result || []
  } catch { /* ignore */ }
}

/**
 * 全部已读：把所有频道的 lastReadId 推到 serverLatestId + 清推送队列。
 * 徽章会自动从 number/dot 变成 none。
 */
function handleMarkAllRead() {
  uni.showModal({
    title: '标记全部已读',
    content: '所有频道未读将被清除',
    success: (res) => {
      if (!res.confirm) return
      infoStore.markAllChannelsRead()
      infoStore.clearToastQueue()
      uni.showToast({ title: '已全部标记为已读', icon: 'success' })
    }
  })
}

// ==================== 生命周期 ====================

onShow(async () => {
  await ensure({ requireSchoolLogin: false })
  if (!isSearchMode.value) fetchList(true)
  loadChannels()
})

onHide(() => {
  // 离开页面清空临时筛选（强调临时性）
  if (tempFilterIds.value !== null) tempFilterIds.value = null
  showFilterDrawer.value = false
})

onReachBottom(() => {
  if (isSubscribedMode.value) return  // 订阅视图不分页
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

      <!-- 信息来源选择器 + 管理订阅入口（仅已订阅视图显示）+ 全部已读 -->
      <view class="source-selector">
        <view class="source-picker-trigger" @tap="showSourcePicker = true">
          <t-icon name="view-list" size="32rpx" color="#0052d9" />
          <text class="source-label">{{ sourceFilter.label }}</text>
          <t-icon name="chevron-down" size="28rpx" color="#999" />
        </view>
        <view v-if="isSubscribedMode" class="manage-sub-btn" @tap="openSubscribePage">
          <t-icon name="setting" size="36rpx" color="#0052d9" />
          <text>管理订阅</text>
        </view>
        <!-- 有徽章时才显示"全部已读" -->
        <view v-if="infoStore.badge.mode !== 'none'" class="mark-all-btn" @tap="handleMarkAllRead">
          <t-icon name="check-circle" size="32rpx" color="#07c160" />
          <text>全部已读</text>
        </view>
      </view>

      <!-- 第一层 Tab：内容大类（教务内网组不展示，它们自成体系）-->
      <view v-if="!isFixedChannel" class="tab-bar">
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

      <!-- 订阅视图的临时筛选栏 -->
      <view v-if="canFilter" class="filter-row">
        <view class="filter-status">
          <text v-if="isTempFilterActive" class="filter-label active">筛选中 {{ effectiveSourceIds.length }}/{{ subscriptionStore.count }}</text>
          <text v-else class="filter-label">已订阅 {{ subscriptionStore.count }}</text>
        </view>
        <view class="filter-actions">
          <text v-if="isTempFilterActive" class="clear-filter" @tap="handleFilterClear">清除</text>
          <view class="filter-btn" @tap="openFilterDrawer">
            <t-icon name="filter" size="32rpx" color="#0052d9" />
            <text>筛选</text>
          </view>
        </view>
      </view>

      <!-- 搜索模式提示 -->
      <view v-if="isSearchMode" class="search-mode-tip">
        <text>搜索结果：{{ list.length }} 条</text>
        <view class="clear-search" @click="handleClearSearch">
          <t-icon name="close" size="28rpx" />
          <text>清除搜索</text>
        </view>
      </view>

      <!-- 未登录提示（教务内网所有固定频道都需要登录） -->
      <view v-if="isFixedChannel && !isLoggedIn" class="login-tip">
        <t-icon name="info-circle" size="32rpx" />
        <text>登录后可查看教务内网内容</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading && list.length === 0" class="loading-wrap">
        <t-loading theme="circular" size="80rpx" />
        <text class="loading-text">加载中...</text>
      </view>

      <!-- 列表 -->
      <view v-else class="list">
        <!-- 教务 inbox 空态：cookies 可能没 init，提供手动触发按钮 -->
        <view
          v-if="isAcdmChannel && isLoggedIn && list.length === 0 && !loading"
          class="subscribed-empty"
        >
          <t-icon name="mail" size="80rpx" color="#ccc" />
          <text class="empty-title">暂无内容</text>
          <text class="empty-hint">如果登录后该频道一直为空，可能是教务 cookie 没初始化成功</text>
          <view class="go-subscribe-btn" :class="{ disabled: acdmIniting }" @tap="handleInitAcdm">
            <text>{{ acdmIniting ? '初始化中...' : '初始化教务信息' }}</text>
          </view>
        </view>

        <!-- 已订阅视图空态：区分"没订阅"和"筛选后为空" -->
        <view
          v-if="isSubscribedMode && list.length === 0 && !loading"
          class="subscribed-empty"
        >
          <t-icon name="mail" size="80rpx" color="#ccc" />
          <text v-if="subscriptionStore.count === 0" class="empty-title">还没订阅任何数据源</text>
          <text v-else-if="isTempFilterActive" class="empty-title">当前筛选下没有内容</text>
          <text v-else class="empty-title">订阅的数据源暂无内容</text>
          <view
            v-if="subscriptionStore.count === 0"
            class="go-subscribe-btn"
            @tap="openSubscribePage"
          >
            <text>去管理订阅</text>
          </view>
        </view>

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

        <view v-if="!hasMore && list.length > 0 && !isSearchMode && !isSubscribedMode" class="no-more">
          —— 没有更多了 ——
        </view>

        <view v-if="isSubscribedMode && list.length > 0" class="no-more">
          —— 重在推送 ——
        </view>

        <t-empty v-if="!loading && list.length === 0 && !isSubscribedMode && !(isAcdmChannel && isLoggedIn)" :description="isSearchMode ? '未找到相关内容' : '暂无内容'" />
      </view>
    </view>

    <!-- 信息来源弹窗 -->
    <SourcePicker
      :visible="showSourcePicker"
      :channels="channels"
      @select="handleSourceSelect"
      @close="showSourcePicker = false"
    />

    <!-- 订阅视图的临时筛选弹层 -->
    <FilterDrawer
      :visible="showFilterDrawer"
      :channels="channels"
      :subscribed-ids="subscriptionStore.subscribedIds"
      :selected-ids="effectiveSourceIds"
      @apply="handleFilterApply"
      @clear="handleFilterClear"
      @close="showFilterDrawer = false"
    />

    <!-- 回到顶部 -->
    <t-back-top :fixed="true" text="顶部" />
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
  justify-content: space-between;
  padding: 20rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.source-picker-trigger {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex: 1;
  min-width: 0;
}

.source-label {
  font-size: 30rpx;
  font-weight: 500;
  color: #0052d9;
}

.manage-sub-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  font-size: 24rpx;
  color: #0052d9;
  background: #e6f0ff;
  border-radius: 8rpx;
  flex-shrink: 0;

  &:active {
    background: #d0e0ff;
  }
}

.mark-all-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 14rpx;
  font-size: 24rpx;
  color: #07c160;
  background: #ebfaf0;
  border-radius: 8rpx;
  flex-shrink: 0;
  margin-left: 8rpx;

  &:active {
    background: #d8f0de;
  }
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

/* 订阅视图的筛选栏 */
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.filter-status {
  flex: 1;
}

.filter-label {
  font-size: 24rpx;
  color: #999;

  &.active {
    color: #0052d9;
    font-weight: 600;
  }
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.clear-filter {
  font-size: 24rpx;
  color: #999;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  font-size: 24rpx;
  color: #0052d9;
  background: #e6f0ff;
  border-radius: 8rpx;

  &:active {
    background: #d0e0ff;
  }
}

/* 订阅视图空态 */
.subscribed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  gap: 20rpx;
}

.empty-title {
  font-size: 28rpx;
  color: #999;
}

.empty-hint {
  font-size: 24rpx;
  color: #bbb;
  padding: 0 48rpx;
  text-align: center;
  line-height: 1.5;
}

.go-subscribe-btn {
  margin-top: 20rpx;
  padding: 16rpx 48rpx;
  background: #0052d9;
  color: #fff;
  font-size: 28rpx;
  border-radius: 8rpx;

  &:active {
    background: #003ea5;
  }

  &.disabled {
    background: #a0a0a0;
    pointer-events: none;
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
