<!--
  已订阅视图的临时筛选弹层

  文件：src/components/info/FilterDrawer.vue

  定位：
  - 在"已订阅"视图里临时收窄可见 source 的范围
  - 数据集 = 当前已订阅的 source（由外部传入 subscribedIds）
  - 状态完全受控：父组件持有 selectedIds，这里只 emit apply/clear
  - 不持久化；页面切走 / 清除即复位

  三层结构：分类 (sourceOrg) → 频道 (channel) → source
  - 每一层有三态复选框：☑ 全选 / ◐ 部分 / ☐ 全不选
  - 点父级：在"全选"和"全不选"之间切换
  - 点叶子：独立切换

  Props:
  - visible: boolean
  - channels: Channel[]（getChannels 返回的全量）
  - subscribedIds: string[]（用户订阅的 source id 列表）
  - selectedIds: string[]（当前临时选中的子集；初值 = subscribedIds）

  Events:
  - apply: [string[]]  — 用户点"应用"，传出新的 selectedIds
  - clear: []          — 用户点"清除"（= 全选 = 取消临时筛选）
  - close: []
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Channel } from '@/types/info'
import { SOURCE_ORG_TREE } from '@/types/info'
import { extractBoolean } from '@/utils/tdesign'

const props = defineProps<{
    visible: boolean
    channels: Channel[]
    subscribedIds: string[]
    selectedIds: string[]
}>()

const emit = defineEmits<{
    apply: [ids: string[]]
    clear: []
    close: []
}>()

// ==================== 本地草稿 ====================

/** 弹层内部的草稿，点击"应用"才提交给父组件 */
const draftMap = ref<Record<string, true>>({})
const expandedOrgs = ref<Record<string, boolean>>({})

watch(() => [props.visible, props.selectedIds] as const, ([vis]) => {
    if (vis) {
        // 打开弹层时把父组件的 selectedIds 拷进草稿
        const next: Record<string, true> = {}
        for (const id of props.selectedIds) next[id] = true
        draftMap.value = next
    }
}, { immediate: true })

// ==================== 树构建 ====================

/** 已订阅 id 集合，O(1) 查询 */
const subscribedSet = computed(() => {
    const s: Record<string, true> = {}
    for (const id of props.subscribedIds) s[id] = true
    return s
})

/** 按 sourceOrg → channels[] 分组，每个 channel 只保留已订阅的 source */
const orgGroups = computed(() => {
    const groups: Record<string, Array<{ channel: Channel; sources: { id: string; name: string }[] }>> = {}

    for (const ch of props.channels) {
        const org = ch.sourceOrg || 'unknown'
        if (org === 'fixed') continue  // 公文通不在订阅粒度里
        const subscribedInChannel = (ch.sources || []).filter(s => subscribedSet.value[s.id])
        if (subscribedInChannel.length === 0) continue

        if (!groups[org]) groups[org] = []
        groups[org].push({
            channel: ch,
            sources: subscribedInChannel.map(s => ({ id: s.id, name: s.name })),
        })
    }
    return groups
})

/** 分类显示顺序，沿用 SOURCE_ORG_TREE */
const orgList = computed(() =>
    SOURCE_ORG_TREE
        .filter(item => orgGroups.value[item.value])
        .map(item => ({ value: item.value, label: item.label, channels: orgGroups.value[item.value] }))
)

const selectedCount = computed(() => Object.keys(draftMap.value).length)

// ==================== 三态判断 ====================

type TriState = 'all' | 'partial' | 'none'

function orgState(orgValue: string): TriState {
    const groups = orgGroups.value[orgValue] || []
    let total = 0, picked = 0
    for (const g of groups) {
        total += g.sources.length
        for (const s of g.sources) if (draftMap.value[s.id]) picked++
    }
    if (picked === 0) return 'none'
    if (picked === total) return 'all'
    return 'partial'
}

function channelState(ch: Channel, sources: { id: string }[]): TriState {
    let picked = 0
    for (const s of sources) if (draftMap.value[s.id]) picked++
    if (picked === 0) return 'none'
    if (picked === sources.length) return 'all'
    return 'partial'
}

function isSourceSelected(id: string): boolean {
    return draftMap.value[id] === true
}

// ==================== 交互 ====================

function toggleOrg(orgValue: string) {
    const state = orgState(orgValue)
    const groups = orgGroups.value[orgValue] || []
    const allIds = groups.flatMap(g => g.sources.map(s => s.id))
    const next = { ...draftMap.value }
    if (state === 'all') {
        for (const id of allIds) delete next[id]
    } else {
        for (const id of allIds) next[id] = true
    }
    draftMap.value = next
}

function toggleChannel(sources: { id: string }[]) {
    const state = sources.every(s => draftMap.value[s.id]) ? 'all' : 'none'
    const next = { ...draftMap.value }
    if (state === 'all') {
        for (const s of sources) delete next[s.id]
    } else {
        for (const s of sources) next[s.id] = true
    }
    draftMap.value = next
}

function toggleSource(id: string) {
    const next = { ...draftMap.value }
    if (next[id]) delete next[id]
    else next[id] = true
    draftMap.value = next
}

function toggleExpand(orgValue: string) {
    expandedOrgs.value[orgValue] = !expandedOrgs.value[orgValue]
}

function handleApply() {
    emit('apply', Object.keys(draftMap.value))
    emit('close')
}

function handleClear() {
    // 清除 = 回到"全部已订阅"
    draftMap.value = { ...subscribedSet.value }
    emit('clear')
}

function handleVisibleChange(e: any) {
    if (!extractBoolean(e)) emit('close')
}
</script>

<template>
    <t-popup :visible="visible" placement="bottom" @visible-change="handleVisibleChange">
        <view class="filter-drawer">
            <view class="drawer-header">
                <text class="drawer-title">临时筛选</text>
                <view class="header-actions">
                    <text class="header-btn clear" @tap="handleClear">清除</text>
                    <view class="header-close" @tap="emit('close')">
                        <t-icon name="close" size="36rpx" />
                    </view>
                </view>
            </view>

            <view class="drawer-hint">
                <text>只在本次浏览有效，离开或清除后恢复显示全部已订阅</text>
            </view>

            <scroll-view scroll-y class="drawer-body">
                <view v-if="orgList.length === 0" class="empty">
                    <text>还没有订阅数据源</text>
                </view>

                <view v-for="org in orgList" :key="org.value" class="tree-org">
                    <!-- 分类行 -->
                    <view class="row org-row">
                        <view class="checkbox-slot" @tap="toggleOrg(org.value)">
                            <view :class="['tri-box', orgState(org.value)]">
                                <t-icon v-if="orgState(org.value) === 'all'" name="check" size="28rpx" color="#fff" />
                                <view v-else-if="orgState(org.value) === 'partial'" class="dash" />
                            </view>
                        </view>
                        <text class="org-label" @tap="toggleExpand(org.value)">{{ org.label }}</text>
                        <view class="expand-btn" @tap="toggleExpand(org.value)">
                            <t-icon
                                :name="expandedOrgs[org.value] ? 'chevron-up' : 'chevron-down'"
                                size="32rpx"
                                color="#999"
                            />
                        </view>
                    </view>

                    <!-- 频道 + source -->
                    <view v-if="expandedOrgs[org.value]" class="org-children">
                        <view v-for="g in org.channels" :key="g.channel.id" class="tree-channel">
                            <view class="row channel-row" @tap="toggleChannel(g.sources)">
                                <view class="checkbox-slot">
                                    <view :class="['tri-box', channelState(g.channel, g.sources)]">
                                        <t-icon v-if="channelState(g.channel, g.sources) === 'all'" name="check" size="26rpx" color="#fff" />
                                        <view v-else-if="channelState(g.channel, g.sources) === 'partial'" class="dash" />
                                    </view>
                                </view>
                                <text class="channel-label">{{ g.channel.name }}</text>
                            </view>

                            <view v-for="s in g.sources" :key="s.id" class="row source-row" @tap="toggleSource(s.id)">
                                <view class="checkbox-slot">
                                    <view :class="['tri-box', isSourceSelected(s.id) ? 'all' : 'none']">
                                        <t-icon v-if="isSourceSelected(s.id)" name="check" size="24rpx" color="#fff" />
                                    </view>
                                </view>
                                <text class="source-label">{{ s.name }}</text>
                            </view>
                        </view>
                    </view>
                </view>
            </scroll-view>

            <view class="drawer-footer">
                <view class="apply-btn" @tap="handleApply">
                    <text>应用 ({{ selectedCount }})</text>
                </view>
            </view>
        </view>
    </t-popup>
</template>

<style lang="scss" scoped>
.filter-drawer {
    background: #fff;
    border-radius: 24rpx 24rpx 0 0;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}

.drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32rpx;
    border-bottom: 1rpx solid #eee;
}

.drawer-title {
    font-size: 32rpx;
    font-weight: 600;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 24rpx;
}

.header-btn {
    font-size: 28rpx;
    color: #0052d9;

    &.clear {
        color: #999;
    }
}

.header-close {
    padding: 4rpx;
}

.drawer-hint {
    padding: 16rpx 32rpx;
    font-size: 22rpx;
    color: #999;
    background: #f7f8fa;
}

.drawer-body {
    flex: 1;
    max-height: 55vh;
}

.empty {
    padding: 80rpx 0;
    text-align: center;
    color: #999;
    font-size: 26rpx;
}

.row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 20rpx 32rpx;
}

.org-row {
    background: #fff;
    border-bottom: 1rpx solid #f0f0f0;
}

.channel-row {
    background: #fafafa;
    padding-left: 60rpx;
}

.source-row {
    padding-left: 100rpx;
    font-size: 26rpx;

    &:active {
        background: #e6f0ff;
    }
}

.checkbox-slot {
    padding: 8rpx;
}

.tri-box {
    width: 32rpx;
    height: 32rpx;
    border: 2rpx solid #ccc;
    border-radius: 6rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    &.all {
        background: #0052d9;
        border-color: #0052d9;
    }

    &.partial {
        background: #0052d9;
        border-color: #0052d9;
    }

    .dash {
        width: 16rpx;
        height: 4rpx;
        background: #fff;
        border-radius: 2rpx;
    }
}

.org-label {
    flex: 1;
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
}

.channel-label {
    flex: 1;
    font-size: 28rpx;
    color: #555;
}

.source-label {
    flex: 1;
    font-size: 26rpx;
    color: #666;
}

.expand-btn {
    padding: 8rpx 16rpx;
}

.drawer-footer {
    padding: 24rpx 32rpx;
    border-top: 1rpx solid #eee;
}

.apply-btn {
    text-align: center;
    padding: 24rpx 0;
    background: #0052d9;
    color: #fff;
    border-radius: 12rpx;
    font-size: 30rpx;
    font-weight: 600;

    &:active {
        background: #003ea5;
    }
}
</style>
