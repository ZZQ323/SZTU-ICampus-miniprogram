/**
 * 订阅状态管理
 *
 * 文件：src/store/modules/subscription.ts
 *
 * 定位：订阅 = 减噪开关。用户挑选关心的 source，subscribe 模式下的 feed
 *       只返回这些 source 的文章，WS 推送也按此过滤。
 *
 * 设计要点：
 *   - 唯一真理源：subscribedSourceIds（Record 而非 Set，兼容小程序渲染层）
 *   - 上限 20 个 source，到顶 toast 阻止
 *   - 本地持久化到 uni.storage，key 兼容旧 subscribe.vue 的数组格式
 *   - 不做未读计数、不做导入导出、冷启动为空不引导
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'icampus_subscribed_sources'
export const MAX_SUBSCRIPTIONS = 20

function loadFromStorage(): Record<string, true> {
    try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        if (!raw) return {}
        // 兼容旧格式（字符串数组）与新格式（对象）
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        const result: Record<string, true> = {}
        if (Array.isArray(parsed)) {
            for (const id of parsed) result[String(id)] = true
        } else if (parsed && typeof parsed === 'object') {
            for (const id of Object.keys(parsed)) result[id] = true
        }
        return result
    } catch {
        return {}
    }
}

export const useSubscriptionStore = defineStore('subscription', () => {
    const subscribedMap = ref<Record<string, true>>(loadFromStorage())

    const subscribedIds = computed<string[]>(() => Object.keys(subscribedMap.value))
    const count = computed(() => subscribedIds.value.length)
    const isEmpty = computed(() => count.value === 0)
    const isFull = computed(() => count.value >= MAX_SUBSCRIPTIONS)

    /** CSV 形式给后端用 */
    const sourceIdsCsv = computed(() => subscribedIds.value.join(','))

    watch(subscribedMap, (val) => {
        // 持久化沿用数组格式，兼容其他已部署的旧版客户端
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(Object.keys(val)))
    }, { deep: true })

    function isSubscribed(sourceId: string): boolean {
        return subscribedMap.value[sourceId] === true
    }

    /**
     * 添加订阅，返回 true 表示成功，false 表示已达上限被阻止
     */
    function subscribe(sourceId: string): boolean {
        if (subscribedMap.value[sourceId]) return true
        if (count.value >= MAX_SUBSCRIPTIONS) return false
        subscribedMap.value[sourceId] = true
        return true
    }

    function unsubscribe(sourceId: string): void {
        if (subscribedMap.value[sourceId]) {
            delete subscribedMap.value[sourceId]
        }
    }

    /**
     * 切换订阅，返回结果
     *   - added: 成功添加
     *   - removed: 成功取消
     *   - full: 已达上限被阻止
     */
    function toggle(sourceId: string): 'added' | 'removed' | 'full' {
        if (isSubscribed(sourceId)) {
            unsubscribe(sourceId)
            return 'removed'
        }
        return subscribe(sourceId) ? 'added' : 'full'
    }

    function clear(): void {
        subscribedMap.value = {}
    }

    return {
        subscribedMap,
        subscribedIds,
        count,
        isEmpty,
        isFull,
        sourceIdsCsv,
        isSubscribed,
        subscribe,
        unsubscribe,
        toggle,
        clear,
    }
})
