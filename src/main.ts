import App from '@/App.vue';
import setupPlugins from '@/plugins';
import { createSSRApp } from 'vue';
// 引入 TDesign
import 'tdesign-uniapp/common/style/theme/index.css';

export function createApp() {
  const app = createSSRApp(App);
  app.use(setupPlugins);
  return {
    app,
  };
}