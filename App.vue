<script>
import { getItem, setItem, getDailyRecord, setDailyRecord, getDailyRecordKey, getCurrentUsername } from '@/utils/storage.js'
import { getToday, getPrevDay } from '@/utils/dateHelper.js'
import {
  setTheme,
  setFontSize,
  applyNavigationBarTheme,
  applyTabBarTheme,
  getSystemTheme,
  resolveThemeName
} from '@/utils/theme.js'

const APP_SETTINGS_KEY = 'appSettings'
const AUTO_SYNC_LAST_RUN_PREFIX = 'autoSyncLastRunDate__'

let hasThemeChangeListener = false

function getAutoSyncLastRunKey() {
  const username = getCurrentUsername() || 'default'
  return `${AUTO_SYNC_LAST_RUN_PREFIX}${username}`
}

function sanitizeTaskForToday(task, index) {
  return {
    id: task && task.id ? task.id : `task_${Date.now()}_${index}`,
    name: task && task.name ? task.name : '未命名任务',
    sortOrder: index + 1,
    status: 'not_started',
    checkinText: '',
    images: [],
    video: '',
    videoDuration: 0,
    mediaType: ''
  }
}

export default {
  onLaunch() {
    this.initAppAppearance()
    this.registerThemeChangeListener()
    this.tryAutoSyncYesterdayToToday()
  },
  onShow() {
    this.initAppAppearance()
    this.tryAutoSyncYesterdayToToday()
  },
  onHide() {
    console.log('App Hide')
  },
  methods: {
    initAppAppearance(systemThemeOverride) {
      const settings = getItem(APP_SETTINGS_KEY) || {}
      const systemTheme = systemThemeOverride || getSystemTheme()
      const themeName = resolveThemeName(settings, systemTheme)
      const fontLevel = settings.fontSize || 'normal'

      const themeVars = setTheme(themeName)
      const fontConfig = setFontSize(fontLevel)
      applyNavigationBarTheme(themeName)
      applyTabBarTheme(themeName)

      const app = getApp()
      app.globalData = app.globalData || {}
      app.globalData.appSettings = settings
      app.globalData.systemTheme = systemTheme
      app.globalData.activeTheme = themeName
      app.globalData.themeVars = themeVars
      app.globalData.fontConfig = fontConfig
    },
    registerThemeChangeListener() {
      if (hasThemeChangeListener || typeof uni.onThemeChange !== 'function') {
        return
      }
      uni.onThemeChange((res) => {
        const settings = getItem(APP_SETTINGS_KEY) || {}
        const followSystem = !!(settings.followSystem || settings.themeMode === 'system' || settings.theme === 'system')
        if (!followSystem) {
          return
        }
        this.initAppAppearance((res && res.theme) || 'light')
      })
      hasThemeChangeListener = true
    },
    tryAutoSyncYesterdayToToday() {
      const settings = getItem(APP_SETTINGS_KEY) || {}
      if (!settings.autoSyncTask) {
        return
      }

      const today = getToday()
      const lastRunKey = getAutoSyncLastRunKey()
      const lastRunDate = getItem(lastRunKey)
      if (lastRunDate === today) {
        return
      }

      // 今天已初始化（包括空数组）时不自动覆盖。
      const todayRaw = getItem(getDailyRecordKey(today))
      if (Array.isArray(todayRaw)) {
        setItem(lastRunKey, today)
        return
      }

      const yesterday = getPrevDay(today)
      const yesterdayTasks = getDailyRecord(yesterday)
      if (!Array.isArray(yesterdayTasks) || yesterdayTasks.length === 0) {
        setItem(lastRunKey, today)
        return
      }

      const copiedTasks = yesterdayTasks
        .slice()
        .sort((a, b) => Number(a && a.sortOrder ? a.sortOrder : 0) - Number(b && b.sortOrder ? b.sortOrder : 0))
        .map((task, index) => sanitizeTaskForToday(task, index))

      setDailyRecord(today, copiedTasks)
      setItem(lastRunKey, today)
    }
  }
}
</script>

<style>
:root {
  --app-bg-color: #eefcf8;
  --app-nav-bg: #e8faf4;
  --app-font-size: 28rpx;
}
</style>
