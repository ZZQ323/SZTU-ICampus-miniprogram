/**
 * 倒计时 Hook
 * 
 * 文件：src/hooks/useCountdown.ts
 * 
 * 用于短信验证码等场景的倒计时
 */

import { ref, computed, onUnmounted } from 'vue'

/**
 * 倒计时 Hook
 * 
 * @param initialSeconds 初始秒数，默认 60
 * 
 * 使用示例：
 * ```ts
 * const { count, counting, start, reset } = useCountdown(60)
 * 
 * async function sendSms() {
 *   await authApi.requestSms(userId)
 *   start()
 * }
 * ```
 */
export function useCountdown(initialSeconds = 60) {
    const count = ref(0)
    let timer: ReturnType<typeof setInterval> | null = null

    const counting = computed(() => count.value > 0)

    const buttonText = computed(() =>
        counting.value ? `${count.value}s` : '获取验证码'
    )

    function start(seconds = initialSeconds) {
        if (counting.value) return

        count.value = seconds
        timer = setInterval(() => {
            count.value--
            if (count.value <= 0) {
                stop()
            }
        }, 1000)
    }

    function stop() {
        if (timer) {
            clearInterval(timer)
            timer = null
        }
        count.value = 0
    }

    function reset() {
        stop()
    }

    // 组件卸载时清理定时器
    onUnmounted(() => {
        stop()
    })

    return {
        count,
        counting,
        buttonText,
        start,
        stop,
        reset,
    }
}