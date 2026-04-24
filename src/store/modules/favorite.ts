/**
 * 收藏状态管理
 *
 * 文件：src/store/modules/favorite.ts
 *
 * 定位：用户主动收藏感兴趣的文章，后续通过收藏列表快速访问。
 *
 * 设计要点：
 *   - 存 metadata snapshot（title / publishDate / author / sourceOrgName），不存正文
 *   - 点开走 detail.vue 重新请求（学校原文为准，可能失效）
 *   - 失效处理由 detail.vue 的失败 modal 承担："从收藏移除"按钮
 *   - 上限 50 条，超过时 toast 阻止
 *   - 本地持久化到 uni.storage（key: icampus_favorites）
 *
 * 架构契合度：
 *   - 项目原则"无持久化数据库"：前端本地存 ID+快照 = 不依赖后端任何存储
 *   - 原文始终走后端爬取 → Redis 缓存，和正常阅读路径完全一致
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { FavoriteItem } from '@/types/favorite'

const STORAGE_KEY = 'icampus_favorites'
export const MAX_FAVORITES = 50

function keyOf(channelId: string, articleId: string): string {
    return `${channelId}::${articleId}`
}

export const useFavoriteStore = defineStore('favorite', () => {
    const items = ref<FavoriteItem[]>(loadFromStorage())

    const count = computed(() => items.value.length)
    const isFull = computed(() => items.value.length >= MAX_FAVORITES)

    /** 快速查找用：key -> item */
    const itemsByKey = computed(() => {
        const m: Record<string, FavoriteItem> = {}
        for (const item of items.value) m[keyOf(item.channelId, item.articleId)] = item
        return m
    })

    function isFavorited(channelId: string, articleId: string): boolean {
        return keyOf(channelId, articleId) in itemsByKey.value
    }

    /**
     * 添加收藏。
     * @returns 'added' | 'already' | 'full'
     */
    function add(meta: Omit<FavoriteItem, 'addedAt'>): 'added' | 'already' | 'full' {
        if (isFavorited(meta.channelId, meta.articleId)) return 'already'
        if (isFull.value) return 'full'
        items.value.unshift({ ...meta, addedAt: Date.now() })
        return 'added'
    }

    function remove(channelId: string, articleId: string): boolean {
        const idx = items.value.findIndex(
            i => i.channelId === channelId && String(i.articleId) === String(articleId)
        )
        if (idx >= 0) {
            items.value.splice(idx, 1)
            return true
        }
        return false
    }

    /**
     * 切换收藏，返回结果。
     *   - added: 成功添加
     *   - removed: 成功取消
     *   - full: 已达上限被阻止
     */
    function toggle(meta: Omit<FavoriteItem, 'addedAt'>): 'added' | 'removed' | 'full' {
        if (isFavorited(meta.channelId, meta.articleId)) {
            remove(meta.channelId, meta.articleId)
            return 'removed'
        }
        const r = add(meta)
        return r === 'full' ? 'full' : 'added'
    }

    function clear(): void {
        items.value = []
    }

    // ==================== 持久化 ====================

    watch(items, (newItems) => {
        try {
            uni.setStorageSync(STORAGE_KEY, newItems)
        } catch { /* ignore */ }
    }, { deep: true })

    function loadFromStorage(): FavoriteItem[] {
        try {
            const data = uni.getStorageSync(STORAGE_KEY)
            if (Array.isArray(data)) return data as FavoriteItem[]
        } catch { /* ignore */ }
        return []
    }

    return {
        items,
        count,
        isFull,
        isFavorited,
        add,
        remove,
        toggle,
        clear,
    }
})
