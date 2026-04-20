<!--
  校历页面

  文件：src/pages/school-calendar/school-calendar.vue

  布局（对应设计稿）：
    ┌────────────┬───────────────────┐
    │ ● 2025-26  │ ┌─ 秋季学期 ─┐     │
    │ ○ 2024-25  │ │  <image>   │     │
    │ ○ 2023-24  │ └────────────┘     │
    │ ...        │ ┌─ 春季学期 ─┐     │
    │            │ │  <image>   │     │
    └────────────┴───────────────────┘

  数据：
    - 学年列表：/calendar/v1/years
    - 每学年的春秋校历：/calendar/v1/{year}
    - 图片走后端 /proxy/image 代理，拼 BASE_URL 后可直接 <image src>

  交互：
    - 默认打开时选中最近的学年（列表第一项）
    - 点击年份切换
    - 点击图片 → uni.previewImage（小程序原生长按可保存）
    - 数据按学年 Map 缓存在页面，避免重复请求
-->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { calendarApi, type CalendarPayload } from '@/api/calendar-apis'
import { BASE_URL } from '@/utils/http'

// ==================== 状态 ====================

const years = ref<string[]>([])
const activeYear = ref('')
const yearsLoading = ref(false)

const calendarCache = ref<Record<string, CalendarPayload | null>>({})
const calendarLoading = ref(false)
const error = ref('')

// ==================== 计算属性 ====================

const currentCalendar = computed<CalendarPayload | null>(() => {
    if (!activeYear.value) return null
    return calendarCache.value[activeYear.value] ?? null
})

/** 拼接图片绝对 URL（后端返回 /proxy/image?url=...） */
function absUrl(path: string | undefined | null): string {
    if (!path) return ''
    if (path.startsWith('http')) return path
    return BASE_URL + path
}

const autumnUrl = computed(() => absUrl(currentCalendar.value?.autumn?.imageUrl))
const springUrl = computed(() => absUrl(currentCalendar.value?.spring?.imageUrl))

const hasAny = computed(() => !!(autumnUrl.value || springUrl.value))

// ==================== 方法 ====================

async function loadYears() {
    yearsLoading.value = true
    error.value = ''
    try {
        const list = await calendarApi.getYears()
        years.value = list || []
        if (years.value.length > 0 && !activeYear.value) {
            activeYear.value = years.value[0]
            await loadCalendar(activeYear.value)
        }
    } catch (e: any) {
        error.value = '学年列表加载失败'
        console.error('[Calendar] years failed', e)
    } finally {
        yearsLoading.value = false
    }
}

async function loadCalendar(year: string) {
    if (calendarCache.value[year] !== undefined) return  // 已命中缓存（含 null）
    calendarLoading.value = true
    try {
        const data = await calendarApi.getByYear(year)
        calendarCache.value = { ...calendarCache.value, [year]: data ?? null }
    } catch (e: any) {
        console.error('[Calendar] year failed', year, e)
        calendarCache.value = { ...calendarCache.value, [year]: null }
    } finally {
        calendarLoading.value = false
    }
}

async function selectYear(year: string) {
    if (year === activeYear.value) return
    activeYear.value = year
    await loadCalendar(year)
}

/** 点图预览（支持长按保存 / 分享） */
function previewImage(which: 'autumn' | 'spring') {
    const urls = [autumnUrl.value, springUrl.value].filter(Boolean)
    const current = which === 'autumn' ? autumnUrl.value : springUrl.value
    if (!current) return
    uni.previewImage({ urls, current })
}

// ==================== 生命周期 ====================

onMounted(() => {
    loadYears()
})
</script>

<template>
    <view class="calendar-page">
        <view v-if="yearsLoading" class="loading-wrap">
            <t-loading theme="circular" size="80rpx" />
            <text class="loading-text">加载学年列表...</text>
        </view>

        <view v-else-if="error" class="error-wrap">
            <text>{{ error }}</text>
            <view class="retry-btn" @tap="loadYears">重试</view>
        </view>

        <view v-else class="layout">
            <!-- 左侧：学年时间轴 -->
            <scroll-view scroll-y class="year-rail">
                <view
                    v-for="y in years"
                    :key="y"
                    :class="['year-item', { active: y === activeYear }]"
                    @tap="selectYear(y)"
                >
                    <view class="year-dot" />
                    <text class="year-label">{{ y.replace('-', ' - ') }}学年度</text>
                </view>
            </scroll-view>

            <!-- 右侧：两学期校历 -->
            <scroll-view scroll-y class="main">
                <view v-if="calendarLoading" class="loading-wrap">
                    <t-loading theme="circular" size="64rpx" />
                    <text class="loading-text">加载中...</text>
                </view>

                <template v-else>
                    <view v-if="currentCalendar?.autumn" class="semester-card" @tap="previewImage('autumn')">
                        <view class="semester-header">
                            <text class="semester-title">{{ currentCalendar.autumn.label || '秋季学期' }}</text>
                        </view>
                        <image
                            class="semester-image"
                            :src="autumnUrl"
                            mode="widthFix"
                            show-menu-by-longpress
                        />
                    </view>

                    <view v-if="currentCalendar?.spring" class="semester-card" @tap="previewImage('spring')">
                        <view class="semester-header">
                            <text class="semester-title">{{ currentCalendar.spring.label || '春季学期' }}</text>
                        </view>
                        <image
                            class="semester-image"
                            :src="springUrl"
                            mode="widthFix"
                            show-menu-by-longpress
                        />
                    </view>

                    <view v-if="!hasAny" class="empty-wrap">
                        <t-empty description="暂无该学年校历" />
                    </view>
                </template>
            </scroll-view>
        </view>
    </view>
</template>

<style lang="scss" scoped>
.calendar-page {
    height: 100vh;
    background: #f5f5f5;
    display: flex;
    flex-direction: column;
}

.layout {
    flex: 1;
    display: flex;
    overflow: hidden;
}

/* ==================== 左侧学年轨 ==================== */

.year-rail {
    width: 220rpx;
    flex-shrink: 0;
    background: #fff;
    border-right: 1rpx solid #eee;
    padding: 24rpx 0;
}

.year-item {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 20rpx 20rpx 20rpx 28rpx;
    position: relative;

    /* 垂直虚线连接 */
    &::before {
        content: '';
        position: absolute;
        left: 34rpx;
        top: 0;
        bottom: 0;
        width: 2rpx;
        background: #e5e5e5;
    }

    .year-dot {
        width: 14rpx;
        height: 14rpx;
        border-radius: 50%;
        background: #fff;
        border: 2rpx solid #ccc;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
    }

    .year-label {
        font-size: 24rpx;
        color: #666;
    }

    &.active {
        .year-dot {
            background: #0052d9;
            border-color: #0052d9;
            box-shadow: 0 0 0 6rpx rgba(0, 82, 217, 0.15);
        }

        .year-label {
            color: #0052d9;
            font-weight: 600;
        }
    }

    &:active {
        background: #f5f5f5;
    }
}

/* ==================== 右侧主区 ==================== */

.main {
    flex: 1;
    padding: 20rpx;
}

.semester-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

    &:active {
        opacity: 0.85;
    }
}

.semester-header {
    margin-bottom: 20rpx;
}

.semester-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #0052d9;
}

.semester-image {
    width: 100%;
    display: block;
    border-radius: 8rpx;
    background: #f7f8fa;
}

/* ==================== 状态 ==================== */

.loading-wrap,
.error-wrap,
.empty-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 120rpx 0;
    gap: 20rpx;
}

.loading-text {
    color: #999;
    font-size: 26rpx;
}

.error-wrap {
    color: #f54a45;
    font-size: 28rpx;
}

.retry-btn {
    padding: 16rpx 48rpx;
    background: #0052d9;
    color: #fff;
    font-size: 28rpx;
    border-radius: 8rpx;
}
</style>
