<script>
    export default {
        onLaunch: function() {
            console.log('App Launch');
        },
        onShow: function() {
            console.log('App Show');
            // 尝试从本地读取 token
            const token = wx.getStorageSync('token');
            const expireTime = wx.getStorageSync('tokenExpireTime');
            if (token && Date.now() < expireTime) {
                // token 有效，直接使用
                this.globalData.token = token;
            } else {
                console.log("token 不存在或已过期，重新登录");
                uni.navigateTo({url:"/pages/login/index"});
            }
        },
        onHide: function() {
            console.log('App Hide');
        }
    }
</script>

<style>
    /*每个页面公共css */
</style>