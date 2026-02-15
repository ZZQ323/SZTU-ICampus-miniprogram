<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { mpUpdate } from '@/utils/index';
onLaunch(() => {
    console.log('App Launch');
    // #ifdef MP-WEIXIN
    mpUpdate();
    // #endif
});
onShow(() => {
    console.log('App Show');
});
onHide(() => {
    console.log('App Hide');
});
</script>

<style>
/*每个页面公共css */
</style>