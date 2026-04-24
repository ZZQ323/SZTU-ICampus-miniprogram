<!--
  我的收藏
  文件：src/pages/favorite/favorite.vue

  功能：
  - 展示所有收藏的文章（按 addedAt 降序）
  - 点卡片 → 进 detail.vue（走正常爬取路径）
  - 卡片右上 ✗ → 移除该条
  - 右上角"清空全部" 按钮
  - 底部小字说明：原文可能失效

  数据所有权：favoriteStore（本地持久化）
-->

<script setup lang="ts">
import { computed } from 'vue'
import PageLayout from '@/components/PageLayout.vue'
import BackTop from '@/components/BackTop.vue'
import { useBackTop } from '@/hooks/useBackTop'
import { useFavoriteStore, MAX_FAVORITES } from '@/store/modules/favorite'
import type { FavoriteItem } from '@/types/favorite'

const favoriteStore = useFavoriteStore()
const { visible: backTopVisible, scrollToTop } = useBackTop()

const items = computed<FavoriteItem[]>(() => favoriteStore.items)

function formatAddedAt(ts: number): string {
  const now = Date.now()
  const diffMin = Math.floor((now - ts) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小时前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay} 天前`
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function handleOpen(item: FavoriteItem) {
  uni.navigateTo({
    url: `/pages/notice/detail?id=${item.articleId}&channelId=${item.channelId}&category=${item.categoryCode || ''}`
  })
}

function handleRemove(item: FavoriteItem) {
  uni.showModal({
    title: '取消收藏',
    content: `确认取消收藏"${item.title.length > 20 ? item.title.slice(0, 20) + '...' : item.title}"？`,
    success: (res) => {
      if (res.confirm) {
        favoriteStore.remove(item.channelId, item.articleId)
        uni.showToast({ title: '已移除', icon: 'none' })
      }
    }
  })
}

function handleClearAll() {
  if (items.value.length === 0) return
  uni.showModal({
    title: '清空收藏',
    content: `将移除全部 ${items.value.length} 条收藏，此操作不可撤销。`,
    confirmText: '清空',
    success: (res) => {
      if (res.confirm) {
        favoriteStore.clear()
        uni.showToast({ title: '已清空', icon: 'none' })
      }
    }
  })
}
</script>

<template>
  <PageLayout>
    <view class="favorite-page">

      <!-- 顶部信息条 -->
      <view class="top-bar">
        <view class="count-label">
          <text>已收藏 {{ items.length }}</text>
          <text class="cap">/{{ MAX_FAVORITES }}</text>
        </view>
        <view v-if="items.length > 0" class="clear-btn" @tap="handleClearAll">
          <t-icon name="delete" size="28rpx" color="#fa5151" />
          <text>清空</text>
        </view>
      </view>

      <!-- 空态 -->
      <view v-if="items.length === 0" class="empty">
        <t-icon name="star" size="120rpx" color="#ddd" />
        <text class="empty-title">还没有收藏任何文章</text>
        <text class="empty-hint">在文章详情页点击右上角 ☆ 可添加收藏</text>
      </view>

      <!-- 列表 -->
      <view v-else class="list">
        <view v-for="item in items" :key="`${item.channelId}::${item.articleId}`"
          class="fav-card" @tap="handleOpen(item)">
          <view class="card-main">
            <view class="card-title">{{ item.title }}</view>
            <view class="card-meta">
              <text v-if="item.sourceOrgName" class="source">{{ item.sourceOrgName }}</text>
              <text v-if="item.author" class="author">· {{ item.author }}</text>
              <text v-if="item.publishDate" class="time">· {{ item.publishDate }}</text>
            </view>
            <view class="card-added">收藏于 {{ formatAddedAt(item.addedAt) }}</view>
          </view>
          <view class="card-remove" @tap.stop="handleRemove(item)">
            <t-icon name="close" size="36rpx" color="#bbb" />
          </view>
        </view>

        <!-- 底部小字说明 -->
        <view class="footer-note">
          收藏保存的是文章索引，原文如被学校删除将无法查看
        </view>
      </view>

      <BackTop :visible="backTopVisible" @tap="scrollToTop" />
    </view>
  </PageLayout>
</template>

<style lang="scss" scoped>
.favorite-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.count-label {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.count-label .cap {
  color: #999;
  font-weight: 400;
  margin-left: 4rpx;
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  font-size: 24rpx;
  color: #fa5151;
  background: #fff3f3;
  border-radius: 8rpx;

  &:active {
    background: #ffdddd;
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0 60rpx;
  gap: 24rpx;
}

.empty-title {
  font-size: 30rpx;
  color: #999;
}

.empty-hint {
  font-size: 24rpx;
  color: #bbb;
  padding: 0 48rpx;
  text-align: center;
}

.list {
  padding: 16rpx 20rpx;
}

.fav-card {
  display: flex;
  align-items: flex-start;
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  &:active {
    background: #fafafa;
  }
}

.card-main {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 30rpx;
  color: #181818;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 12rpx;
  /* 两行截断 */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-meta {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 4rpx;
}

.card-meta .source {
  color: #0052d9;
}

.card-added {
  font-size: 22rpx;
  color: #bbb;
}

.card-remove {
  flex-shrink: 0;
  padding: 8rpx;
  margin-top: -4rpx;

  &:active {
    background: #f0f0f0;
    border-radius: 50%;
  }
}

.footer-note {
  padding: 32rpx 32rpx 48rpx;
  font-size: 22rpx;
  color: #bbb;
  text-align: center;
  line-height: 1.5;
}
</style>
