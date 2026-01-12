
export interface IUserInfo {
    userId: string
    userRole: 'student' | 'teacher' | 'admin'
    schoolName: string
    campus: string
    department: string
    major: string
    className: string
    grade: string
    nickname: string
    avatarUrl: string
}

export interface IAppGlobalData {
    baseURL: string
    settings: {
        theme: 'light' | 'dark'
        notifyEnabled: boolean
        autoLogin: boolean
    }
    userInfo?: IUserInfo
    isLoggedIn: boolean
}