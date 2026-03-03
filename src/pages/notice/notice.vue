<script setup lang="ts">
/**
 * 公告列表页
 * 
 * 文件：src/pages/notice/notice.vue
 */
import { ref, computed } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import { useUserStore } from '@/store/modules/user'
import { useAnnouncement } from '@/hooks/useAnnouncement'
import { announcementApi } from '@/api/announcement-apis'
import type { AnnouncementMeta } from '@/types/announcement'
import { CATEGORY_LIST } from '@/types/announcement'

// ==================== Store ====================

const userStore = useUserStore()
const { isRead, markAsRead, markItemAsRead, subscribeSSE } = useAnnouncement()

// ==================== 状态 ====================

const loading = ref(false)
const refreshing = ref(false)
const list = ref<AnnouncementMeta[]>([])
const page = ref(1)
const hasMore = ref(true)
const latestId = ref('0')

/** 当前选中的分类 */
const activeCategory = ref('')

/** 搜索关键词 */
const searchKeyword = ref('')

/** 是否显示搜索框 */
const showSearch = ref(false)

// ==================== 计算属性 ====================

/** 是否已登录 */
const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)

// ==================== Mock 数据（未登录时显示） ====================

const mockData: AnnouncementMeta[] = [
  {
    id: '50731',
    url: 'info/1018/50731.htm',
    category: '1018',
    categoryName: '教务',
    department: '教务处',
    title: '关于2025年春季学期教学安排的通知',
    publishDate: '2025-01-15'
  },
  {
    id: '50730',
    url: 'info/1020/50730.htm',
    category: '1020',
    categoryName: '行政',
    department: '学校办公室',
    title: '关于春节假期值班安排的通知',
    publishDate: '2025-01-14'
  },
  {
    id: '50729',
    url: 'info/1021/50729.htm',
    category: '1021',
    categoryName: '学工',
    department: '学生处',
    title: '关于开展2025年学生资助工作的通知',
    publishDate: '2025-01-13'
  },
  {
    id: '50728',
    url: 'info/1022/50728.htm',
    category: '1022',
    categoryName: '校园',
    department: '后勤保障部',
    title: '图书馆寒假开放时间调整通知',
    publishDate: '2025-01-12'
  },
  {
    id: '50727',
    url: 'info/1019/50727.htm',
    category: '1019',
    categoryName: '科研',
    department: '科研处',
    title: '关于申报2025年度科研项目的通知',
    publishDate: '2025-01-11'
  },
]

// ==================== 方法 ====================

/** 获取公告列表 */
async function fetchList(reset = false) {
  if (!isLoggedIn.value) {
    // 未登录，显示 mock 数据
    list.value = filterByCategory(mockData)
    return
  }

  if (reset) {
    page.value = 1
    hasMore.value = true
  }

  if (!hasMore.value && !reset) return

  loading.value = true

  try {
    const params = {
      category: activeCategory.value || undefined,
      page: page.value,
      pageSize: 20
    }

    const result = await announcementApi.getList(params)

    if (reset) {
      list.value = result.list
    } else {
      list.value = [...list.value, ...result.list]
    }

    latestId.value = result.latestId
    hasMore.value = result.hasMore

    // 首次加载完成，标记为已读
    if (reset && result.list.length > 0) {
      markAsRead(result.latestId)
    }

  } catch (e) {
    console.error('[Notice] 获取列表失败', e)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

/** 按分类筛选（用于 mock 数据） */
function filterByCategory(data: AnnouncementMeta[]): AnnouncementMeta[] {
  if (!activeCategory.value) return data
  return data.filter(item => item.category === activeCategory.value)
}

/** 切换分类 */
function handleCategoryChange(category: string) {
  activeCategory.value = category
  fetchList(true)
}

/** 搜索 */
async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    fetchList(true)
    return
  }

  if (!isLoggedIn.value) {
    // 未登录，本地搜索 mock 数据
    const keyword = searchKeyword.value.toLowerCase()
    list.value = mockData.filter(item =>
      item.title.toLowerCase().includes(keyword) ||
      item.department.toLowerCase().includes(keyword)
    )
    return
  }

  loading.value = true
  try {
    const result = await announcementApi.search(searchKeyword.value, 50)
    list.value = result
    hasMore.value = false
  } catch (e) {
    console.error('[Notice] 搜索失败', e)
    uni.showToast({ title: '搜索失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

/** 点击公告项 */
function handleItemClick(item: AnnouncementMeta) {
  markItemAsRead(item.id)
  uni.navigateTo({
    url: `/pages/notice/detail?id=${item.id}&category=${item.category}`
  })
}

/** 切换搜索框显示 */
function toggleSearch() {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    searchKeyword.value = ''
    fetchList(true)
  }
}

/** 刷新 */
async function handleRefresh() {
  refreshing.value = true
  await fetchList(true)
}

// ==================== 生命周期 ====================

onShow(() => {
  // 每次显示时刷新
  fetchList(true)

  // 已登录则订阅 SSE
  if (isLoggedIn.value) {
    subscribeSSE()
  }
})

onReachBottom(() => {
  if (!loading.value && hasMore.value) {
    page.value++
    fetchList()
  }
})

onPullDownRefresh(() => {
  handleRefresh().finally(() => {
    uni.stopPullDownRefresh()
  })
})
</script>

<template>
  <PageLayout>
    <view class="notice-page">
      <!-- 顶部操作栏 -->
      <view class="header">
        <!-- 分类标签 -->
        <scroll-view v-if="!showSearch" scroll-x class="category-scroll">
          <view class="category-list">
            <view v-for="cat in CATEGORY_LIST" :key="cat.code"
              :class="['category-item', { active: activeCategory === cat.code }]"
              @click="handleCategoryChange(cat.code)">
              {{ cat.name }}
            </view>
          </view>
        </scroll-view>

        <!-- 搜索框 -->
        <view v-else class="search-box">
          <t-input v-model="searchKeyword" placeholder="搜索公告标题" clearable @confirm="handleSearch">
            <template #suffix-icon>
              <t-icon name="search" @click="handleSearch" />
            </template>
          </t-input>
        </view>

        <!-- 搜索按钮 -->
        <view class="search-btn" @click="toggleSearch">
          <t-icon :name="showSearch ? 'close' : 'search'" size="44rpx" />
        </view>
      </view>

      <!-- 未登录提示 -->
      <view v-if="!isLoggedIn" class="login-tip">
        <t-icon name="info-circle" size="32rpx" />
        <text>登录后可查看最新公告</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading && list.length === 0" class="loading-wrap">
        <t-loading theme="circular" size="80rpx" />
        <text class="loading-text">加载中...</text>
      </view>

      <!-- 公告列表 -->
      <view v-else class="list">
        <view v-for="item in list" :key="item.id" :class="['notice-item', { unread: !isRead(item.id) }]"
          @click="handleItemClick(item)">
          <view class="item-header">
            <view class="category-tag" :class="'cat-' + item.category">
              {{ item.categoryName }}
            </view>
            <text class="date">{{ item.publishDate }}</text>
          </view>
          <view class="item-title">{{ item.title }}</view>
          <view class="item-footer">
            <text class="department">{{ item.department }}</text>
            <t-icon name="chevron-right" size="32rpx" class="arrow" />
          </view>
        </view>

        <!-- 加载更多 -->
        <view v-if="loading && list.length > 0" class="load-more">
          <t-loading theme="circular" size="40rpx" />
          <text>加载中...</text>
        </view>

        <!-- 没有更多 -->
        <view v-if="!hasMore && list.length > 0" class="no-more">
          —— 没有更多了 ——
        </view>

        <!-- 空状态 -->
        <t-empty v-if="!loading && list.length === 0" description="暂无公告" />
      </view>
    </view>
  </PageLayout>
</template>

<style lang="scss" scoped>
.notice-page {
  min-height: 100vh;
  background: #f5f5f5;
}

// 顶部操作栏
.header {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}

.category-scroll {
  flex: 1;
  white-space: nowrap;
}

.category-list {
  display: inline-flex;
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

.search-box {
  flex: 1;
}

.search-btn {
  padding: 12rpx;
  margin-left: 16rpx;
}

// 未登录提示
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

// 加载状态
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

// 公告列表
.list {
  padding: 20rpx;
}

.notice-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  &.unread {
    border-left: 6rpx solid #0052d9;
  }
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.category-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
  color: #fff;

  &.cat-1018 {
    background: #0052d9;
  }

  // 教务
  &.cat-1019 {
    background: #07c160;
  }

  // 科研
  &.cat-1020 {
    background: #fa5151;
  }

  // 行政
  &.cat-1021 {
    background: #ff976a;
  }

  // 学工
  &.cat-1022 {
    background: #9c27b0;
  }

  // 校园
}

.date {
  font-size: 24rpx;
  color: #999;
}

.item-title {
  font-size: 30rpx;
  color: #333;
  line-height: 1.5;
  margin-bottom: 16rpx;
  // 两行省略
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.department {
  font-size: 24rpx;
  color: #666;
}

.arrow {
  color: #ccc;
}

// 加载更多
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