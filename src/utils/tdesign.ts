/**
 * TDesign 小程序组件工具函数
 * 
 * 文件：src/utils/tdesign.ts
 * 
 * 用于处理 TDesign 组件事件的通用函数
 */

// ==================== 类型定义 ====================

/**
 * TDesign 组件 change 事件的通用类型
 * 
 * TDesign 事件格式可能是：
 * - { detail: { value: T } }  -- 标准小程序事件格式
 * - { value: T }              -- 简化格式
 * - T                         -- 直接值
 */
export interface TDesignChangeEvent<T = string> {
    detail?: { value: T }
    value?: T
}

// ==================== 值提取函数 ====================

/**
 * 从 TDesign 事件中提取字符串值
 * 
 * @param e 事件对象或直接值
 * @returns 提取的字符串值
 * 
 * @example
 * ```ts
 * function onInputChange(e) {
 *   inputValue.value = extractString(e)
 * }
 * ```
 */
export function extractString(e: TDesignChangeEvent<string> | string | undefined | null): string {
    if (e === null || e === undefined) return ''
    if (typeof e === 'string') return e
    return e?.detail?.value ?? e?.value ?? ''
}

/**
 * 从 TDesign 事件中提取数字值
 * 
 * @param e 事件对象或直接值
 * @param defaultValue 默认值
 * @returns 提取的数字值
 */
export function extractNumber(
    e: TDesignChangeEvent<number> | number | string | undefined | null,
    defaultValue: number = 0
): number {
    if (e === null || e === undefined) return defaultValue
    if (typeof e === 'number') return e
    if (typeof e === 'string') return Number(e) || defaultValue

    const value = e?.detail?.value ?? e?.value
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value) || defaultValue
    return defaultValue
}

/**
 * 从 TDesign 事件中提取布尔值
 * 
 * @param e 事件对象或直接值
 * @returns 提取的布尔值
 * 
 * @example
 * ```ts
 * function onSwitchChange(e) {
 *   isEnabled.value = extractBoolean(e)
 * }
 * ```
 */
export function extractBoolean(
    e: TDesignChangeEvent<boolean> | boolean | undefined | null
): boolean {
    if (e === null || e === undefined) return false
    if (typeof e === 'boolean') return e
    return e?.detail?.value ?? e?.value ?? false
}

/**
 * 从 TDesign 事件中提取数组值
 * 
 * @param e 事件对象或直接值
 * @returns 提取的数组值
 * 
 * @example
 * ```ts
 * function onCheckboxChange(e) {
 *   selectedItems.value = extractArray<string>(e)
 * }
 * ```
 */
export function extractArray<T = string>(
    e: TDesignChangeEvent<T[]> | T[] | undefined | null
): T[] {
    if (e === null || e === undefined) return []
    if (Array.isArray(e)) return e
    return e?.detail?.value ?? e?.value ?? []
}

/**
 * 通用值提取函数
 * 
 * @param e 事件对象或直接值
 * @param defaultValue 默认值（用于推断类型）
 * @returns 提取的值
 * 
 * @example
 * ```ts
 * // 字符串
 * const str = extractValue(e, '')
 * 
 * // 数字
 * const num = extractValue(e, 0)
 * 
 * // 布尔
 * const bool = extractValue(e, false)
 * 
 * // 数组
 * const arr = extractValue(e, [] as string[])
 * ```
 */
export function extractValue<T>(
    e: TDesignChangeEvent<T> | T | undefined | null,
    defaultValue: T
): T {
    if (e === null || e === undefined) return defaultValue

    // 如果 e 的类型和 defaultValue 相同，直接返回
    if (typeof e === typeof defaultValue && typeof e !== 'object') {
        return e as T
    }

    // 数组特殊处理
    if (Array.isArray(defaultValue)) {
        if (Array.isArray(e)) return e as T
        const event = e as TDesignChangeEvent<T>
        return (event?.detail?.value ?? event?.value ?? defaultValue) as T
    }

    // 对象类型（事件对象）
    if (typeof e === 'object') {
        const event = e as TDesignChangeEvent<T>
        return event?.detail?.value ?? event?.value ?? defaultValue
    }

    return defaultValue
}

// ==================== 组合式 API ====================

/**
 * 创建一个响应式输入绑定
 * 
 * 返回 value 和 onChange 函数，可直接用于 t-input
 * 
 * @example
 * ```ts
 * const username = ref('')
 * const usernameBinding = useInputBinding(username)
 * 
 * // 模板中：
 * // <t-input :value="usernameBinding.value" @change="usernameBinding.onChange" />
 * ```
 */
export function useInputBinding(modelRef: { value: string }) {
    return {
        get value() {
            return modelRef.value
        },
        onChange(e: TDesignChangeEvent<string> | string) {
            modelRef.value = extractString(e)
        },
        onClear() {
            modelRef.value = ''
        }
    }
}

/**
 * 创建一个响应式开关绑定
 */
export function useSwitchBinding(modelRef: { value: boolean }) {
    return {
        get value() {
            return modelRef.value
        },
        onChange(e: TDesignChangeEvent<boolean> | boolean) {
            modelRef.value = extractBoolean(e)
        }
    }
}

/**
 * 创建一个响应式多选绑定
 */
export function useCheckboxBinding<T = string>(modelRef: { value: T[] }) {
    return {
        get value() {
            return modelRef.value
        },
        onChange(e: TDesignChangeEvent<T[]> | T[]) {
            modelRef.value = extractArray<T>(e)
        }
    }
}