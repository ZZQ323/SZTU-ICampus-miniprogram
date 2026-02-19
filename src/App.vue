<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user' 

onLaunch(async () => {
  console.log('App Launch')
  tokenCheck();
})
onShow(() => {
  console.log('App Show')
})
onHide(() => {console.log('App Hide')})

function tokenCheck()
{
  const userStore = useUserStore()
  
  // 1. 检查本地是否已有 token
  if (userStore.hasToken) {
    console.log('本地已有 token，跳过初始化')
    // 可选：异步验证 token 有效性（不阻塞启动）
    // userStore.checkSchoolSession().catch(() => {})
    return
  }
  
  // 2. 没有 token，需要初始化
  console.log('本地无 token，开始初始化')
  try {
    userStore.initToken();
  } catch (e) {
    console.error('Token 初始化失败', e)
  }
}

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
      tokenCheck();
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
