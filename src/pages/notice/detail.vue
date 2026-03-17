<!--
  公告列表页（重构版）
  
  文件：src/pages/notice/notice.vue
  
  改动点：
  1. 使用新的 infoApi
  2. 使用 useInfoStore 管理未读状态
  3. 使用 InfoListItem 组件
  4. 进入页面自动标记已读
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import PageLayout from '@/components/PageLayout.vue'
import InfoListItem from '@/components/info/InfoListItem.vue'
import { useUserStore } from '@/store/modules/user'
import { useInfoStore } from '@/store/modules/info'
import { useAuthGuard } from '@/hooks/composables/useAuthGuard'
import { infoApi } from '@/api/info-api'
import type { InfoItemMeta } from '@/types/info'
import { CATEGORY_LIST } from '@/types/info'

// ==================== Hooks ====================

const userStore = useUserStore()
const infoStore = useInfoStore()
const { ensure, isReady } = useAuthGuard()

// ==================== 状态 ====================

const loading = ref(false)
const refreshing = ref(false)
const list = ref<InfoItemMeta[]>([])
const page = ref(1)
const hasMore = ref(true)
const latestId = ref('0')
const activeCategory = ref('')
const searchKeyword = ref('')
const isSearchMode = ref(false)

// ==================== 计算属性 ====================

const isLoggedIn = computed(() => userStore.isSchoolLoggedIn)

// ==================== Mock 数据（未登录时显示） ====================

const mockData: InfoItemMeta[] = [
    {
        id: '50731',
        title: '关于2025年春季学期教学安排的通知',
        categoryCode: '1018',
        categoryName: '教务',
        sourceName: '教务处',
        publishDate: '2025-01-15',
        channelId: 'announcement',
    },
    {
        id: '50730',
        title: '关于春节假期值班安排的通知',
        categoryCode: '1020',
        categoryName: '行政',
        sourceName: '学校办公室',
        publishDate: '2025-01-14',
        channelId: 'announcement',
    },
    {
        id: '50729',
        title: '关于开展2025年学生资助工作的通知',
        categoryCode: '1021',
        categoryName: '学工',
        sourceName: '学生处',
        publishDate: '2025-01-13',
        channelId: 'announcement',
    },
    {
        id: '50728',
        title: '图书馆寒假开放时间调整通知',
        categoryCode: '1022',
        categoryName: '校园',
        sourceName: '后勤保障部',
        publishDate: '2025-01-12',
        channelId: 'announcement',
    },
    {
        id: '50727',
        title: '关于申报2025年度科研项目的通知',
        categoryCode: '1019',
        categoryName: '科研',
        sourceName: '科研处',
        publishDate: '2025-01-11',
        channelId: 'announcement',
    },
]

// ==================== 方法 ====================

async function fetchList(reset = false) {
    // 未登录显示 mock 数据
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
            channelId: 'announcement',
            categoryCode: activeCategory.value || undefined,
            page: page.value,
            pageSize: 20
        })

        // 转换字段（兼容）
        const items = result.items.map(item => ({
            ...item,
            channelId: 'announcement',
        }))

        if (reset) {
            list.value = items
        } else {
            list.value = [...list.value, ...items]
        }

        latestId.value = result.latestId || '0'
        hasMore.value = result.hasMore

        // 更新服务端最新 ID
        if (result.latestId) {
            infoStore.updateServerLatestId('announcement', result.latestId)
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

    if (!keyword) {
        isSearchMode.value = false
        fetchList(true)
        return
    }

    if (!isLoggedIn.value) {
        // 未登录时本地搜索
        const filtered = mockData.filter(item =>
            item.title.toLowerCase().includes(keyword.toLowerCase())
        )
        list.value = filterByCategory(filtered)
        isSearchMode.value = true
        return
    }

    loading.value = true
    isSearchMode.value = true

    try {
        const result = await infoApi.search(keyword, 'announcement', 50)
        list.value = result.map(item => ({
            ...item,
            channelId: 'announcement',
        }))
        hasMore.value = false
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
    // 已在 InfoListItem 组件中标记已读
    uni.navigateTo({
        url: `/pages/notice/detail?id=${item.id}&category=${item.categoryCode || ''}`
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
    // 等待认证检查完成
    await ensure({
        requireSchoolLogin: false
    })

    // 认证检查完成后加载数据
    if (!isSearchMode.value) {
        fetchList(true)
    }

    // 进入页面时标记频道已读
    if (isLoggedIn.value) {
        infoStore.markChannelRead('announcement')
    }
})

onReachBottom(() => {
    if (!loading.value && hasMore.value && !isSearchMode.value) {
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
        <!-- 只有认证就绪后才显示页面内容 -->
        <view v-if="isReady" class="notice-page">
            <!-- 顶部搜索框 -->
            <view class="search-header">
                <view class="search-box">
                    <t-input :value="searchKeyword" placeholder="搜索公告标题..." clearable @change="onSearchInputChanged"
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

            <!-- 分类标签 -->
            <scroll-view scroll-x class="category-scroll" :show-scrollbar="false">
                <view class="category-list">
                    <view v-for="cat in CATEGORY_LIST" :key="cat.code"
                        :class="['category-item', { active: activeCategory === cat.code }]"
                        @click="handleCategoryChange(cat.code)">
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
                <text>登录后可查看最新公告</text>
            </view>

            <!-- 加载状态 -->
            <view v-if="loading && list.length === 0" class="loading-wrap">
                <t-loading theme="circular" size="80rpx" />
                <text class="loading-text">加载中...</text>
            </view>

            <!-- 公告列表 -->
            <view v-else class="list">
                <InfoListItem v-for="item in list" :key="item.id" :item="item" @tap="handleItemClick" />

                <!-- 加载更多 -->
                <view v-if="loading && list.length > 0" class="load-more">
                    <t-loading theme="circular" size="40rpx" />
                    <text>加载中...</text>
                </view>

                <!-- 没有更多 -->
                <view v-if="!hasMore && list.length > 0 && !isSearchMode" class="no-more">
                    —— 没有更多了 ——
                </view>

                <!-- 空状态 -->
                <t-empty v-if="!loading && list.length === 0" :description="isSearchMode ? '未找到相关公告' : '暂无公告'" />
            </view>
        </view>
    </PageLayout>
</template>

<style lang="scss" scoped>
.notice-page {
    min-height: 100vh;
    background: #f5f5f5;
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