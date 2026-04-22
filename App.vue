<script>
import { getItem, setItem, getDailyRecord, setDailyRecord } from '@/utils/storage.js'
import { getToday, getPrevDay } from '@/utils/dateHelper.js'
import { setTheme, setFontSize } from '@/utils/theme.js'

const APP_SETTINGS_KEY = 'appSettings'
const AUTO_SYNC_LAST_RUN_KEY = 'autoSyncLastRunDate'
const DAILY_KEY_PREFIX = 'dailyRecord_'

let hasThemeChangeListener = false

function getDailyKey(dateStr) {
  return `${DAILY_KEY_PREFIX}${dateStr}`
}

function getSystemTheme() {
  try {
    const info = uni.getSystemInfoSync()
    return info && info.theme === 'dark' ? 'dark' : 'light'
  } catch (error) {
    return 'light'
  }
}

function resolveThemeName(settings, systemTheme = 'light') {
  const rawTheme = settings && settings.theme ? settings.theme : 'mint'
  const followSystem = !!(settings && (settings.followSystem || settings.themeMode === 'system' || rawTheme === 'system'))
  const baseTheme = rawTheme === 'system' ? 'mint' : rawTheme
  const useDark = followSystem ? systemTheme === 'dark' : !!(settings && settings.useDarkTheme)
  return useDark ? `${baseTheme}-dark` : baseTheme
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

      setTheme(themeName)
      setFontSize(fontLevel)

      const app = getApp()
      app.globalData = app.globalData || {}
      app.globalData.appSettings = settings
      app.globalData.systemTheme = systemTheme
      app.globalData.activeTheme = themeName
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
      const lastRunDate = getItem(AUTO_SYNC_LAST_RUN_KEY)
      if (lastRunDate === today) {
        return
      }

      // 今天已初始化（包括空数组）时不自动覆盖。
      const todayRaw = getItem(getDailyKey(today))
      if (Array.isArray(todayRaw)) {
        setItem(AUTO_SYNC_LAST_RUN_KEY, today)
        return
      }

      const yesterday = getPrevDay(today)
      const yesterdayTasks = getDailyRecord(yesterday)
      if (!Array.isArray(yesterdayTasks) || yesterdayTasks.length === 0) {
        setItem(AUTO_SYNC_LAST_RUN_KEY, today)
        return
      }

      const copiedTasks = yesterdayTasks
        .slice()
        .sort((a, b) => Number(a && a.sortOrder ? a.sortOrder : 0) - Number(b && b.sortOrder ? b.sortOrder : 0))
        .map((task, index) => sanitizeTaskForToday(task, index))

      setDailyRecord(today, copiedTasks)
      setItem(AUTO_SYNC_LAST_RUN_KEY, today)
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
