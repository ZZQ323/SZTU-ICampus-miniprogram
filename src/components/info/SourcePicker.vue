<!--
  信息来源选择器组件

  文件：src/components/info/SourcePicker.vue

  可折叠树状结构：
  - 左侧分类列表（全部/已订阅/公文通/学校/职能部门/教辅/群团/学院）
  - 点击分类文字 → 选中该分类（emit select 事件）
  - 点击展开箭头 → 显示该分类下的具体频道/单位
  - 点击具体单位 → 选中该单位

  Props:
  - channels: Channel[] — 从 API 获取的频道列表
  - visible: boolean — 控制弹窗显示

  Events:
  - select: { sourceOrg?: string, channelId?: string, label: string }
  - close
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Channel } from '@/types/info'
import { SOURCE_ORG_TREE } from '@/types/info'
import { extractBoolean } from '@/utils/tdesign'

const props = defineProps<{
  channels: Channel[]
  visible: boolean
}>()

const emit = defineEmits<{
  select: [payload: { sourceOrg?: string; channelId?: string; label: string }]
  close: []
}>()

/** 当前展开的分类 */
const expandedOrg = ref<string>('')

/** 按 sourceOrg 分组的频道 */
const groupedChannels = computed(() => {
  const groups: Record<string, Channel[]> = {}
  for (const ch of props.channels) {
    const org = ch.sourceOrg || 'unknown'
    if (!groups[org]) groups[org] = []
    groups[org].push(ch)
  }
  return groups
})

/** 获取分类下的频道列表 */
function getChannelsForOrg(orgValue: string): Channel[] {
  if (!orgValue || orgValue === 'subscribed') return []
  return groupedChannels.value[orgValue] || []
}

/** 是否有子项可展开 */
function hasChildren(orgValue: string): boolean {
  return getChannelsForOrg(orgValue).length > 0
}

/** 切换展开/折叠 */
function toggleExpand(orgValue: string) {
  expandedOrg.value = expandedOrg.value === orgValue ? '' : orgValue
}

/** 选中分类（点击文字） */
function selectOrg(orgValue: string, label: string) {
  if (orgValue === 'subscribed') {
    emit('select', { sourceOrg: 'subscribed', label: '已订阅' })
  } else {
    // fixed 也走 sourceOrg 维度（3 个子频道: 公文通 / 已收公告 / 消息通知），
    // 点 label 选择父组 = 聚合显示，点子项单独显示
    emit('select', { sourceOrg: orgValue || undefined, label })
  }
  emit('close')
}

/** 选中具体频道 */
function selectChannel(channel: Channel) {
  emit('select', { channelId: channel.id, label: channel.name })
  emit('close')
}

function handleVisibleChange(e: any) {
  if (!extractBoolean(e)) emit('close')
}
</script>

<template>
  <t-popup
    :visible="visible"
    placement="bottom"
    @visible-change="handleVisibleChange"
  >
    <view class="source-picker">
      <view class="picker-header">
        <text class="picker-title">选择信息来源</text>
        <view class="picker-close" @tap="emit('close')">
          <t-icon name="close" size="40rpx" />
        </view>
      </view>

      <scroll-view scroll-y class="picker-body">
        <view v-for="item in SOURCE_ORG_TREE" :key="item.value" class="tree-node">
          <!-- 分类行 -->
          <view class="node-row" @tap="selectOrg(item.value, item.label)">
            <text class="node-label">{{ item.label }}</text>
            <!-- 展开箭头（有子项时显示） -->
            <view
              v-if="hasChildren(item.value)"
              class="expand-btn"
              @tap.stop="toggleExpand(item.value)"
            >
              <t-icon
                :name="expandedOrg === item.value ? 'chevron-up' : 'chevron-down'"
                size="32rpx"
                color="#999"
              />
            </view>
          </view>

          <!-- 展开的子项（具体频道） -->
          <view
            v-if="expandedOrg === item.value && hasChildren(item.value)"
            class="node-children"
          >
            <view
              v-for="ch in getChannelsForOrg(item.value)"
              :key="ch.id"
              class="child-item"
              @tap="selectChannel(ch)"
            >
              <text>{{ ch.name }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </t-popup>
</template>

<style lang="scss" scoped>
.source-picker {
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid #eee;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
}

.picker-close {
  padding: 8rpx;
}

.picker-body {
  max-height: 55vh;
  padding: 8rpx 0;
}

.tree-node {
  border-bottom: 1rpx solid #f5f5f5;
}

.node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
}

.node-label {
  font-size: 30rpx;
  color: #333;
}

.expand-btn {
  padding: 8rpx 16rpx;
}

.node-children {
  background: #fafafa;
  padding-left: 32rpx;
}

.child-item {
  padding: 24rpx 32rpx;
  font-size: 28rpx;
  color: #666;
  border-top: 1rpx solid #f0f0f0;

  &:active {
    background: #e6f0ff;
  }
}
</style>
