/**
 * 公告相关 API
 * 
 * 文件：src/api/announcement-apis.ts
 * 
 * ⭐ 注意：由于 HTTP 拦截器已解包 { code, message, data }
 *    泛型直接写业务数据类型即可
 */

import { request } from '@/utils/http'
import type {
    AnnouncementListVo,
    AnnouncementContent,
    AnnouncementMeta,
    AnnouncementSystemStatus
} from '@/types/announcement'

export const announcementApi = {
    // ==================== 列表查询 ====================

    /**
     * 获取公告列表
     * @param category 分类代码（可选）：1018/1019/1020/1021/1022
     * @param page 页码，默认1
     * @param pageSize 每页数量，默认20
     */
    getList: (params?: { category?: string; page?: number; pageSize?: number }) =>
        request.get<AnnouncementListVo>('/annc/v1/list', { params }),

    /**
     * 获取增量公告（比指定ID更新的公告）
     * @param lastId 上次已读的最新ID
     */
    getIncremental: (lastId: string) =>
        request.get<AnnouncementMeta[]>('/annc/v1/incremental', { params: { lastId } }),

    /**
     * 获取最新公告ID
     */
    getLatestId: () =>
        request.get<{ latestId: string }>('/annc/v1/latest'),

    // ==================== 详情 ====================

    /**
     * 获取公告详情
     * @param id 公告ID
     */
    getDetail: (id: string) =>
        request.get<AnnouncementContent>(`/annc/v1/detail/${id}`),

    // ==================== 搜索 ====================

    /**
     * 标题搜索
     * @param keyword 搜索关键词
     * @param limit 最大返回数量，默认20
     */
    search: (keyword: string, limit?: number) =>
        request.get<AnnouncementMeta[]>('/annc/v1/search', { params: { keyword, limit } }),

    // ==================== 元信息 ====================

    /**
     * 获取分类列表
     */
    getCategories: () =>
        request.get<Record<string, string>>('/annc/v1/categories'),

    /**
     * 获取系统状态
     */
    getStatus: () =>
        request.get<AnnouncementSystemStatus>('/annc/v1/status'),
}

export default announcementApi