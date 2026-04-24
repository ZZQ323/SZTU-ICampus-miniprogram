/**
 * 收藏的文章条目 —— metadata snapshot（不存正文）
 *
 * 原文通过 channelId+articleId 去 detail.vue 重新请求。
 * 原文如被学校删除，请求会 404，detail.vue 的失败 modal 会提示"从收藏移除"。
 */
export interface FavoriteItem {
  channelId: string
  articleId: string
  title: string
  publishDate?: string
  author?: string
  sourceOrgName?: string
  categoryCode?: string
  /** 加入收藏的时间戳（ms），列表按这个降序 */
  addedAt: number
}
