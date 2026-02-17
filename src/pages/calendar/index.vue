<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDate } from '@/utils/date'
import type { ActivityItem } from '@/api/types/calendar'

const selectedDate = ref(formatDate(new Date()))
const currentMonth = ref(new Date())

// Mock 数据
const activities = ref<ActivityItem[]>([
    { id: '1', title: '校园招聘会', date: '2024-01-20', time: '09:00-17:00', location: '体育馆', organizer: '就业指导中心' },
    { id: '2', title: '学术讲座：人工智能前沿', date: '2024-01-20', time: '14:00', location: 'A101', organizer: 'AI学院' },
    { id: '3', title: '社团纳新', date: '2024-01-22', time: '18:00', location: '学生活动中心' },
])

const todayActivities = computed(() =>
    activities.value.filter(a => a.date === selectedDate.value)
)

const hasActivity = (date: string) =>
    activities.value.some(a => a.date === date)

const handleDateChange = (e: { detail: { value: string } }) => {
    selectedDate.value = e.detail.value
}

const handleActivityClick = (item: ActivityItem) => {
    uni.showModal({
        title: item.title,
        content: `时间: ${item.time || '待定'}\n地点: ${item.location || '待定'}\n主办: ${item.organizer || '未知'}`,
        showCancel: false
    })
}
</script>

<template>
    <view class="calendar-page">
        <!-- 日历组件 -->
        <t-calendar :value="selectedDate" @change="handleDateChange" />

        <!-- 当日活动列表 -->
        <view class="activity-section">
            <view class="section-title">
                <text>{{ selectedDate }} 活动</text>
                <t-tag v-if="todayActivities.length" size="small">{{ todayActivities.length }}项</t-tag>
            </view>

            <view class="activity-list">
                <t-cell v-for="item in todayActivities" :key="item.id" :title="item.title"
                    :description="`${item.time || ''} ${item.location || ''}`" :note="item.organizer" arrow
                    @click="handleActivityClick(item)" />
                <t-empty v-if="!todayActivities.length" description="当日无活动" />
            </view>
        </view>
    </view>
</template>

<style lang="scss" scoped>
.calendar-page {
    min-height: 100vh;
    background: #f5f5f5;
}

.activity-section {
    padding: 20rpx;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 20rpx 0;
    font-size: 32rpx;
    font-weight: 500;
}

.activity-list {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
}
</style>