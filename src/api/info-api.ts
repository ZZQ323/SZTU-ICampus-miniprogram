/**
 * 信息流 API
 * 
 * 文件：src/api/info-api.ts
 * 
 * 说明：
 * - 新的统一信息接口
 * - 同时保留旧接口的兼容性
 */

import { request } from '@/utils/http'
import type {
    CategoryTree,
    ChannelWithUnread,
    InfoListResult,
    InfoItemMeta,
    InfoContent,
    InfoListParams,
    FeedParams,
    MarkReadParams,
} from '@/types/info'

export const infoApi = {
    // ==================== 分类目录 ====================

    /**
     * 获取分类树
     */
    getCategoryTree: () =>
        request.get<CategoryTree>('/info/v1/category-tree'),

    /**
     * 获取频道列表（带未读数）
     */
    getChannels: () =>
        request.get<ChannelWithUnread[]>('/info/v1/channels'),

    /**
     * 获取分类列表（兼容旧接口）
     */
    getCategories: (channelId?: string) =>
        request.get<Record<string, string>>('/info/v1/categories', {
            params: { channelId: channelId || 'announcement' }
        }),

    // ==================== 内容列表 ====================

    /**
     * 全局 Feed 查询（跨频道聚合，三维筛选）
     */
    getFeed: (params: FeedParams) =>
        request.get<InfoListResult>('/info/v1/feed', {
            params: {
                sourceOrg: params.sourceOrg || undefined,
                channelId: params.channelId || undefined,
                contentType: params.contentType || undefined,
                subContentType: params.subContentType || undefined,
                page: params.page || 1,
                pageSize: params.pageSize || 20,
            }
        }),

    /**
     * 获取信息列表（按频道，公文通用）
     */
    getList: (params: InfoListParams) =>
        request.get<InfoListResult>('/info/v1/list', {
            params: {
                channelId: params.channelId || 'announcement',
                categoryCode: params.categoryCode,
                page: params.page || 1,
                pageSize: params.pageSize || 20,
            }
        }),

    /**
     * 搜索
     */
    search: (keyword: string, channelId?: string, limit?: number) =>
        request.get<InfoItemMeta[]>('/info/v1/search', {
            params: { keyword, channelId, limit: limit || 20 }
        }),

    // ==================== 内容详情 ====================

    /**
     * 获取详情
     */
    getDetail: (id: string, channelId?: string, categoryCode?: string) =>
        request.get<InfoContent>(`/info/v1/detail/${channelId || 'announcement'}/${id}`, {
            params: { categoryCode }
        }),

    /**
     * 获取详情（简化，兼容旧接口）
     */
    getDetailSimple: (id: string, categoryCode?: string) =>
        request.get<InfoContent>(`/info/v1/detail/${id}`, {
            params: { categoryCode }
        }),

    // ==================== 未读管理 ====================

    /**
     * 获取未读计数
     */
    getUnreadCount: () =>
        request.get<Record<string, number>>('/info/v1/unread'),

    /**
     * 获取最新 ID（单频道）
     */
    getLatestId: (channelId?: string) =>
        request.get<{ channelId: string; latestId: string }>('/info/v1/latest', {
            params: { channelId: channelId || 'announcement' }
        }),

    /**
     * 批量获取所有频道的最新 ID（init 时一次拉取）
     */
    getLatestAll: () =>
        request.get<Record<string, string>>('/info/v1/latest-all'),

    /**
     * 标记已读
     */
    markRead: (params: MarkReadParams) =>
        request.post('/info/v1/mark-read', params),

    // ==================== 系统状态 ====================

    /**
     * 获取系统状态
     */
    getStatus: () =>
        request.get<any>('/info/v1/status'),
}

// ==================== 兼容旧接口 ====================

/**
 * 旧公告接口（兼容）
 * 内部调用新接口
 */
export const announcementApiCompat = {
    getList: (params?: { category?: string; page?: number; pageSize?: number }) =>
        infoApi.getList({
            channelId: 'announcement',
            categoryCode: params?.category,
            page: params?.page,
            pageSize: params?.pageSize,
        }),

    getDetail: (id: string) =>
        infoApi.getDetailSimple(id),

    getLatestId: () =>
        infoApi.getLatestId('announcement'),

    search: (keyword: string, limit?: number) =>
        infoApi.search(keyword, 'announcement', limit),

    getCategories: () =>
        infoApi.getCategories('announcement'),
}

export default infoApi