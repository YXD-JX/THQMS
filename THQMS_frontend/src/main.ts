import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { installAnomalyNotifications } from '@/plugins/anomalyNoti'
import { installAnomalyToDosing } from '@/plugins/anomalyToDosing'
import { installAnomalyBeep } from '@/plugins/anomalyBeep'


const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 安装异常 -> 顶部通知 监听（全局）
installAnomalyNotifications()
// 安装异常 -> 生成补加单据
installAnomalyToDosing()
// 安装异常 -> 全局蜂鸣（尊重声音开关与音量）
installAnomalyBeep()



app.mount('#app')
