import { ref } from 'vue'
import { onPageScroll } from '@dcloudio/uni-app'

/**
 * 回到顶部 hook。
 * <p>
 * 用法：
 * <pre>
 *   const { visible, scrollToTop } = useBackTop()
 *   // template:
 *   <BackTop :visible="visible" @tap="scrollToTop" />
 * </pre>
 * <p>
 * 为什么不能把 BackTop 整个放进 PageLayout？
 * uni-app 的 {@code onPageScroll} 是 <b>页面级</b> 生命周期钩子，只在 page 的 setup()
 * 里生效；在组件里注册无效。所以 scrollTop 的监听必须由每个 page 自己做。
 * 这个 hook 把"监听 + 阈值判断 + 滚到顶"封装起来，页面接入只要两行。
 *
 * @param threshold 超过多少 rpx 才显示按钮，默认 600（约一屏）
 */
export function useBackTop(threshold = 600) {
    const visible = ref(false)

    onPageScroll(({ scrollTop }) => {
        const next = scrollTop > threshold
        if (next !== visible.value) visible.value = next
    })

    function scrollToTop() {
        uni.pageScrollTo({ scrollTop: 0, duration: 200 })
    }

    return { visible, scrollToTop }
}
