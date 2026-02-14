// pages/schedule/schedule.js
import SessionManager from "../../utils/managers/SessionManager";
import HttpClient from '../../utils/core/HttpClient';

Page({
  data: {
    weeks: Array.from({ length: 18 }, (_, i) => "第"+i + 1+"周"),
    currentWeek: 0,
    semesters: [],
    currentSemester: 0,
    showWeekPicker: false,        // 控制周次弹窗
    showSemesterPicker: false,    // 控制学期弹窗
    weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    timeSlots: [
      { label: '第1-2节', time: '08:30-10:00' },
      { label: '第3-4节', time: '10:20-11:50' },
      { label: '第5-6节', time: '14:00-15:30' },
      { label: '第7-8节', time: '15:50-17:20' },
      { label: '第9-10节', time: '18:50-20:10' },
      { label: '第11-12节', time: '20:20-21:40' }
    ],
    courses: [],
    courseMap: new Map(),
    showDetail: false,
    selectedCourse: {}
  },
  // 生成学期列表
  generateSemesters() {
    const userId = wx.getStorageSync('userInfo').userId;
    const enrollYear = parseInt(userId.substring(0, 4)); // 入学年份
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const semesters = [];
    for (let year = enrollYear; year <= currentYear; year++) {
      // 第一学期：9月-春节
      semesters.push(`${year}-${year + 1}-1`);
      // 第二学期：春节-6月
      semesters.push(`${year}-${year + 1}-2`);
      // 第三学期：暑假
      semesters.push(`${year}-${year + 1}-3`);
    }
    // 计算当前学期
    let currentSemester;
    if (currentMonth >= 9) currentSemester = `${currentYear}-${currentYear + 1}-1`;
    else if (currentMonth >= 7) currentSemester = `${currentYear - 1}-${currentYear}-3`;
    else if (currentMonth >= 2) currentSemester = `${currentYear - 1}-${currentYear}-2`;
    else currentSemester = `${currentYear - 1}-${currentYear}-1`;
    this.setData({
      semesters,
      currentSemester: wx.getStorageSync('currentSemester') || currentSemester
    });
  },
  onLoad() {
    this.generateSemesters();
    this.loadSchedule();
  },

  // ==================== 数据加载 ====================
  loadSchedule() {
    SessionManager.getInstance().ensureLogin().then(isLoggedIn => {
      if (isLoggedIn !== true) return;

      // 1. 加载缓存
      this.loadFromCache();

      // 2. 请求最新数据
      this.fetchScheduleFromServer();
    });
  },
  loadFromCache() {
    const cachedCourses = wx.getStorageSync('courses');
    const cachedWeek = wx.getStorageSync('currentWeek');
    if (cachedCourses?.length > 0) {
      this.updateCourses(cachedCourses, cachedWeek || 0);
    }
  },
  fetchScheduleFromServer() {
    wx.showLoading({ title: "加载课表..." });

    const cachedSemester = wx.getStorageSync('currentSemester');

    HttpClient.getInstance().post('/acdmadminsys/v1/schedule', {
      week: this.data.currentWeek,
      semester: cachedSemester,
    }, {
      autoNavigateToError: false,
      showToast: false
    }).then(res => {
      const courses = res.data.courses || [];

      // 保存缓存
      wx.setStorageSync('courses', courses);
      wx.setStorageSync('currentWeek', this.data.currentWeek);

      // 更新视图
      this.updateCourses(courses, this.data.currentWeek);

      wx.hideLoading();
      wx.showToast({ title: '课表已更新', icon: 'success' });
    }).catch(() => {
      wx.hideLoading();
      if (!this.data.courses.length) {
        wx.showToast({ title: '加载失败', icon: 'error' });
      }
    });
  },
  // 打开周次选择器
  openWeekPicker() {
    this.setData({ showWeekPicker: true });
  },
  // 关闭周次选择器（取消）
  closeWeekPicker() {
    this.setData({ showWeekPicker: false });
  },
  // 周次选择确认
  onWeekPickerChange(e) {
    const [weekIndex] = e.detail.value; // 选中下标
    this.setData({
      currentWeek: weekIndex,
      showWeekPicker: false
    });
    // 触发课表重新渲染（原有 onWeekChange 逻辑可合并至此）
    this.onWeekChange({ detail: { value: weekIndex } });
  },

  // 打开学期选择器
  openSemesterPicker() {
    this.setData({ showSemesterPicker: true });
  },
  // 关闭学期选择器（取消）
  closeSemesterPicker() {
    this.setData({ showSemesterPicker: false });
  },
  // 学期选择确认
  onSemesterPickerChange(e) {
    const [semesterIndex] = e.detail.value;
    this.setData({
      currentSemester: semesterIndex,
      showSemesterPicker: false
    });
    // 这里可重新请求对应学期的课表
    this.loadScheduleBySemester(semesterIndex);
  },
  loadScheduleBySemester(){

  },
  // ==================== 数据处理 ====================
  updateCourses(courses, weekIndex) {
    const processedCourses = this.addColorsToCoures(courses);
    const courseMap = this.buildCourseMap(processedCourses);
    this.setData({
      courses: processedCourses,
      courseMap,
      currentWeek: weekIndex
    });
  },
  addColorsToCoures(courses) {
    const colors = ['color1', 'color2', 'color3', 'color4', 'color5'];
    const colorMap = new Map();
    let colorIndex = 0;
    return courses.map(course => {
      if (!colorMap.has(course.courseName)) {
        colorMap.set(course.courseName, colors[colorIndex++ % colors.length]);
      }
      return { ...course, color: colorMap.get(course.courseName) };
    });
  },
  buildCourseMap(courses) {
    const map = new Map();
    courses.forEach(course => {
      const weeks = this.parseWeeks(course.courseWeeks);
      weeks.forEach(week => {
        const key = `${week}-${course.row}-${course.col}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(course);
      });
    });
    return map;
  },
  parseWeeks(weeksStr) {
    if (!weeksStr) return [];
    const clean = weeksStr.replace(/\(周.*$/, '').trim();
    const weeks = new Set();
    clean.split(',').forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end; i++) weeks.add(i);
      } else {
        weeks.add(Number(part));
      }
    });
    return Array.from(weeks);
  },
  // ==================== 视图方法 ====================
  getCourses(rowIndex, colIndex) {
    const weekNum = this.data.weeks[this.data.currentWeek];
    const key = `${weekNum}-${rowIndex}-${colIndex}`;
    return this.data.courseMap.get(key) || [];
  },

  // ==================== 事件处理 ====================
  onWeekChange(e) {
    const weekIndex = parseInt(e.detail.value);
    this.setData({ currentWeek: weekIndex });
    wx.setStorageSync('currentWeek', weekIndex);
  },

  onCourseClick(e) {
    this.setData({
      selectedCourse: e.currentTarget.dataset.course,
      showDetail: true
    });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  }
});