<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user' 

onLaunch(() => {
  console.log('App Launch')
  const userStore = useUserStore();
  userStore.initToken();  // 注意 initToken 是异步的，建议 await
})
onShow(() => {
  console.log('App Show')
})
onHide(() => {console.log('App Hide')})

//  定期刷新会话（可选）
// 每 30 分钟检查一次 Cookie 状态
setInterval(async () => {
  const userStore = useUserStore()
  if (userStore.isSchoolLoggedIn) {
    try {
      const status = await userStore.checkSchoolSession()
      if (status.cookieExpiringSoon) {
        await userStore.refreshSession()
        console.log('Cookie 已自动刷新')
      }
    } catch (e) {
      console.error('自动刷新失败', e)
    }
  }
}, 30 * 60 * 1000);


</script>

<style>
/* 引入 TDesign 的主题样式 —— 这一行是 TDesign 生效的关键 */
@import 'tdesign-uniapp/common/style/theme/index.css';

/* 全局样式 */
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 28rpx;
  color: #333;
  background-color: #f8f8f8;
}
</style>
