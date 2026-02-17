import { ref } from 'vue'

export function useCountdown(seconds = 60) {
    const count = ref(0)
    const isCounting = ref(false)
    let timer: number | null = null

    const start = () => {
        if (isCounting.value) return
        count.value = seconds
        isCounting.value = true
        timer = setInterval(() => {
            count.value--
            if (count.value <= 0) stop()
        }, 1000)
    }

    const stop = () => {
        if (timer) clearInterval(timer)
        timer = null
        isCounting.value = false
        count.value = 0
    }

    return { count, isCounting, start, stop }
}