/** 登录方式枚举（对应后端 LoginType） */
export type LoginType = 'SMS' | 'PASSWORD'

/** 登录请求参数 */
export interface LoginRequestCommand {
  userId: string
  password?: string
  smsCode?: string
  loginType: LoginType
}

/** Token 认证响应（对应 TokenAuthVo.java） */
export interface TokenAuthVo {
  token: string
  expiresIn: number
}

/** 登录结果/Session状态（对应 LoginResultsVo.java） */
export interface LoginResultsVo {
  isLogined: boolean
  wxId?: string
  userId?: string
  realName?: string
  gender?: string
  coments?: string
  schoolName?: string
  avatarURL?: string
  sysChannel?: string
  loginTypes?: LoginType[]
}

/** 历史学号（对应 PossibleUsrIdVO.java，目前为空） */
export interface PossibleUsrIdVO {
  userIds?: string[]
}

/** 用户信息（前端使用） */
export interface UserInfo {
  userId: string
  realName: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}