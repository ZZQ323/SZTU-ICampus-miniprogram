Page({
	/**
	 * 页面的初始数据
	 */
	data: {
	  studentId: '', // 学号
	  password: '',  // 密码
	  remember: false // 是否记忆账号
	},
  
	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad(options) {
	  // 加载本地保存的学号
	  const savedStudentId = wx.getStorageSync('savedStudentId');
	  if (savedStudentId) {
		this.setData({
		  studentId: savedStudentId,
		  remember: true
		});
	  }
	},
  
	/**
	 * 监听学号输入
	 */
	onStudentIdInput(e) {
	  this.setData({
		studentId: e.detail.value
	  });
	},
  
	/**
	 * 监听密码输入
	 */
	onPasswordInput(e) {
	  this.setData({
		password: e.detail.value
	  });
	},
  
	/**
	 * 监听记忆账号复选框变化
	 */
	onRememberChange(e) {
	  this.setData({
		remember: e.detail.value
	  });
	},
  
	/**
	 * 表单提交（登录逻辑）
	 */
	formSubmit(e) {
	  const { studentId, password, remember } = this.data;
  
	  // 简单校验
	  if (!studentId) {
		wx.showToast({ title: '请输入学号', icon: 'none', duration: 2000 });
		return;
	  }
	  if (!password) {
		wx.showToast({ title: '请输入密码', icon: 'none', duration: 2000 });
		return;
	  }
  
	  // 打印登录信息（实际项目对接后端接口）
	  console.log('登录信息：', { studentId, password, remember });
  
	  // 记忆账号：保存/移除本地存储
	  if (remember) {
		wx.setStorageSync('savedStudentId', studentId);
	  } else {
		wx.removeStorageSync('savedStudentId');
	  }
  
	  // 登录提示（实际项目替换为后端接口请求）
	  wx.showModal({
		title: '登录演示',
		content: `学号：${studentId}\n（实际项目中此处对接登录接口）`,
		showCancel: false,
		confirmText: '确定'
	  });
  
	  // 登录成功后跳转首页（示例）
	  // wx.switchTab({ url: '/pages/index/index' });
	},
  
	/**
	 * 忘记密码点击事件
	 */
	forgotPassword() {
	  wx.showModal({
		title: '忘记密码',
		content: '忘记密码功能将跳转到密码找回页面',
		showCancel: false,
		confirmText: '确定'
	  });
	  // 跳转密码找回页面（示例）
	  // wx.navigateTo({ url: '/pages/forgotPassword/forgotPassword' });
	}
  });
  