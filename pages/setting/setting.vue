<template>
  <view class="setting-page" :style="pageStyleVars">
    <scroll-view class="setting-scroll" scroll-y>
      <view class="group-card">
        <text class="group-title">配色方案</text>
        <radio-group @change="onThemeChange">
          <label v-for="item in themeOptions" :key="item.value" class="row">
            <view class="row-left">
              <text class="row-label">{{ item.label }}</text>
              <text class="row-desc">{{ item.desc }}</text>
            </view>
            <radio :value="item.value" :checked="appSettings.theme === item.value" color="#43c5a1" />
          </label>
        </radio-group>
      </view>

      <view class="group-card">
        <text class="group-title">字体大小</text>
        <radio-group @change="onFontSizeChange">
          <label v-for="item in fontOptions" :key="item.value" class="row">
            <text class="row-label">{{ item.label }}</text>
            <radio :value="item.value" :checked="appSettings.fontSize === item.value" color="#43c5a1" />
          </label>
        </radio-group>
      </view>

      <view class="group-card">
        <text class="group-title">自动同步任务</text>
        <view class="row">
          <view class="row-left">
            <text class="row-label">每日首次自动同步昨天任务</text>
            <text class="row-desc">仅复制任务列表，不包含打卡内容</text>
          </view>
          <switch
            :checked="appSettings.autoSyncTask"
            color="#43c5a1"
            @change="onAutoSyncChange"
          />
        </view>
      </view>

      <view class="group-card">
        <text class="group-title">图片保存质量</text>
        <picker :range="imageQualityLabels" :value="imageQualityIndex" @change="onImageQualityChange">
          <view class="row picker-row">
            <text class="row-label">当前选项</text>
            <text class="picker-value">{{ currentImageQualityLabel }}</text>
          </view>
        </picker>
      </view>

      <view class="group-card">
        <text class="group-title">本地缓存管理</text>
        <view class="row">
          <text class="row-label">媒体缓存大小</text>
          <text class="row-value">{{ cacheSizeText }}</text>
        </view>
        <view class="actions">
          <button class="action-btn" @click="handleRefreshCacheSize">刷新大小</button>
          <button class="action-btn warn" :disabled="cleaning" @click="cleanUnusedMedia">清理未引用媒体</button>
        </view>
      </view>

      <view class="group-card">
        <text class="group-title">账号</text>
        <button class="logout-btn" @click="confirmLogout">注销账号</button>
      </view>

      <view class="group-card">
        <view class="row">
          <text class="row-label">版本号</text>
          <text class="row-value">V{{ versionName }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {
  getItem,
  setItem,
  removeItem,
  getAllUsers,
  getCurrentUser,
  TASK_POOL_KEY
} from '@/utils/storage.js'
import { deleteMediaFile, formatFileSize, getFileSize } from '@/utils/mediaHelper.js'
import {
  setTheme,
  setFontSize,
  getThemeVars,
  getFontConfig,
  applyNavigationBarTheme,
  applyTabBarTheme,
  resolveThemeName,
  getSystemTheme
} from '@/utils/theme.js'

const APP_SETTINGS_KEY = 'appSettings'
const USERS_KEY = 'users'
const CURRENT_USER_KEY = 'currentUser'

const DEFAULT_SETTINGS = {
  theme: 'mint',
  fontSize: 'normal',
  autoSyncTask: false,
  imageQuality: 'standard'
}

export default {
  data() {
    return {
      appSettings: { ...DEFAULT_SETTINGS },
      activeThemeVars: getThemeVars('mint'),
      activeFontConfig: getFontConfig('normal'),
      cacheSizeBytes: 0,
      cleaning: false,
      versionName: '1.0.0',
      themeOptions: [
        { label: '薄荷清晨', value: 'mint', desc: '清爽轻盈，适合日常打卡' },
        { label: '暖阳日记', value: 'warm', desc: '温暖柔和，记录治愈时刻' },
        { label: '深海静思', value: 'ocean', desc: '沉静专注，减少视觉干扰' }
      ],
      fontOptions: [
        { label: '小', value: 'small' },
        { label: '标准', value: 'normal' },
        { label: '大', value: 'large' }
      ],
      imageQualityOptions: [
        { label: '原图', value: 'original' },
        { label: '标准压缩', value: 'standard' },
        { label: '高压缩', value: 'high' }
      ]
    }
  },
  computed: {
    imageQualityLabels() {
      return this.imageQualityOptions.map((item) => item.label)
    },
    imageQualityIndex() {
      const idx = this.imageQualityOptions.findIndex((item) => item.value === this.appSettings.imageQuality)
      return idx >= 0 ? idx : 1
    },
    currentImageQualityLabel() {
      const item = this.imageQualityOptions[this.imageQualityIndex]
      return item ? item.label : '标准压缩'
    },
    cacheSizeText() {
      return formatFileSize(this.cacheSizeBytes)
    },
    pageStyleVars() {
      return {
        ...this.activeThemeVars,
        '--page-font-size': this.activeFontConfig.varSize,
        '--font-scale': String(this.activeFontConfig.scale)
      }
    }
  },
  onShow() {
    this.loadSettings()
    this.refreshCacheSize()
  },
  methods: {
    showToast(title, icon = 'none') {
      uni.showToast({ title, icon, duration: 1800 })
    },
    loadSettings() {
      const local = getItem(APP_SETTINGS_KEY)
      this.appSettings = {
        ...DEFAULT_SETTINGS,
        ...(local && typeof local === 'object' ? local : {})
      }
      this.applyAppSettings(this.appSettings, false)
    },
    applyAppSettings(settings, persist = true) {
      const merged = {
        ...DEFAULT_SETTINGS,
        ...(settings || {})
      }
      this.appSettings = merged

      const app = getApp()
      app.globalData = app.globalData || {}
      app.globalData.appSettings = merged
      const systemTheme = app.globalData.systemTheme || getSystemTheme()
      const resolvedTheme = resolveThemeName(merged, systemTheme)
      app.globalData.systemTheme = systemTheme
      app.globalData.activeTheme = resolvedTheme

      this.activeThemeVars = setTheme(resolvedTheme)
      this.activeFontConfig = setFontSize(merged.fontSize)
      applyNavigationBarTheme(resolvedTheme)
      applyTabBarTheme(resolvedTheme)
      app.globalData.themeVars = this.activeThemeVars
      app.globalData.fontConfig = this.activeFontConfig

      if (persist) {
        setItem(APP_SETTINGS_KEY, merged)
      }
    },
    onThemeChange(e) {
      const value = e.detail.value
      this.applyAppSettings({ ...this.appSettings, theme: value })
      this.showToast('配色已更新', 'success')
    },
    onFontSizeChange(e) {
      const value = e.detail.value
      this.applyAppSettings({ ...this.appSettings, fontSize: value })
      this.showToast('字体大小已更新', 'success')
    },
    onAutoSyncChange(e) {
      const checked = !!e.detail.value
      this.applyAppSettings({ ...this.appSettings, autoSyncTask: checked })
      this.showToast('设置已保存', 'success')
    },
    onImageQualityChange(e) {
      const index = Number(e.detail.value)
      const option = this.imageQualityOptions[index] || this.imageQualityOptions[1]
      this.applyAppSettings({ ...this.appSettings, imageQuality: option.value })
      this.showToast('图片质量已更新', 'success')
    },
    normalizePath(path) {
      return String(path || '').split('?')[0].replace(/\\/g, '/')
    },
    getDailyStorageKeys() {
      const info = uni.getStorageInfoSync()
      const keys = (info && info.keys) || []
      return keys.filter((key) => key.startsWith('dailyRecord_') || key.startsWith('daily_'))
    },
    collectReferencedMediaSet() {
      const refs = new Set()
      const keys = this.getDailyStorageKeys()

      keys.forEach((key) => {
        const records = getItem(key)
        if (!Array.isArray(records)) {
          return
        }
        records.forEach((task) => {
          const images = Array.isArray(task && task.images)
            ? task.images
            : Array.isArray(task && task.checkinImages)
              ? task.checkinImages
              : []
          images.forEach((imgPath) => {
            if (imgPath) {
              refs.add(this.normalizePath(imgPath))
            }
          })

          const videoPath = (task && (task.video || task.videoPath)) || ''
          if (videoPath) {
            refs.add(this.normalizePath(videoPath))
          }
        })
      })

      return refs
    },
    async listMediaFiles() {
      // #ifdef APP-PLUS
      return this.listMediaFilesApp()
      // #endif

      // #ifdef MP-WEIXIN
      return this.listMediaFilesMp()
      // #endif

      // #ifndef APP-PLUS
      // #ifndef MP-WEIXIN
      return []
      // #endif
      // #endif
    },
    listMediaFilesApp() {
      return new Promise((resolve) => {
        plus.io.requestFileSystem(
          plus.io.PRIVATE_DOC,
          (fs) => {
            fs.root.getDirectory(
              'media',
              { create: false },
              (dirEntry) => {
                const reader = dirEntry.createReader()
                reader.readEntries(async (entries) => {
                  const files = []
                  for (let i = 0; i < entries.length; i += 1) {
                    const entry = entries[i]
                    if (!entry.isFile) {
                      continue
                    }
                    const path = entry.toURL()
                    let size = 0
                    try {
                      size = await getFileSize(path)
                    } catch (error) {
                      size = 0
                    }
                    files.push({ path, size })
                  }
                  resolve(files)
                }, () => resolve([]))
              },
              () => resolve([])
            )
          },
          () => resolve([])
        )
      })
    },
    listMediaFilesMp() {
      try {
        const fs = wx.getFileSystemManager()
        const base = `${wx.env.USER_DATA_PATH}/media`
        const names = fs.readdirSync(base)
        const files = []
        for (let i = 0; i < names.length; i += 1) {
          const path = `${base}/${names[i]}`
          let size = 0
          try {
            const stat = fs.statSync(path)
            size = Number(stat && stat.stats ? stat.stats.size : stat.size || 0)
          } catch (error) {
            size = 0
          }
          files.push({ path, size })
        }
        return Promise.resolve(files)
      } catch (error) {
        return Promise.resolve([])
      }
    },
    async refreshCacheSize(showFeedback = false) {
      const files = await this.listMediaFiles()
      this.cacheSizeBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0)
      if (showFeedback) {
        this.showToast(`当前缓存 ${this.cacheSizeText}`, 'none')
      }
    },
    async handleRefreshCacheSize() {
      uni.showLoading({ title: '刷新中...' })
      try {
        await this.refreshCacheSize(true)
      } finally {
        uni.hideLoading()
      }
    },
    async cleanUnusedMedia() {
      if (this.cleaning) {
        return
      }
      this.cleaning = true
      uni.showLoading({ title: '清理中...' })

      try {
        const allFiles = await this.listMediaFiles()
        const refs = this.collectReferencedMediaSet()

        const unused = allFiles.filter((file) => {
          const normalized = this.normalizePath(file.path)
          return !refs.has(normalized)
        })

        if (unused.length === 0) {
          this.showToast('没有可清理的媒体')
          return
        }

        let freed = 0
        for (let i = 0; i < unused.length; i += 1) {
          const item = unused[i]
          const ok = await deleteMediaFile(item.path)
          if (ok) {
            freed += Number(item.size || 0)
          }
        }

        await this.refreshCacheSize()
        this.showToast(`已释放 ${formatFileSize(freed)}`, 'success')
      } finally {
        uni.hideLoading()
        this.cleaning = false
      }
    },
    confirmLogout() {
      uni.showModal({
        title: '确认注销',
        content: '注销后将删除本地账号与数据，是否继续？',
        confirmText: '注销',
        confirmColor: '#e86a70',
        success: (res) => {
          if (res.confirm) {
            this.logoutAccount()
          }
        }
      })
    },
    async logoutAccount() {
      uni.showLoading({ title: '正在注销...' })
      try {
        const currentUser = getCurrentUser()
        const allUsers = getAllUsers()
        const nextUsers = allUsers.filter((item) => {
          if (!currentUser || !currentUser.username) {
            return true
          }
          return item && item.username !== currentUser.username
        })

        setItem(USERS_KEY, nextUsers)
        removeItem(TASK_POOL_KEY)
        removeItem(APP_SETTINGS_KEY)

        const dailyKeys = this.getDailyStorageKeys()
        dailyKeys.forEach((key) => removeItem(key))

        const mediaFiles = await this.listMediaFiles()
        for (let i = 0; i < mediaFiles.length; i += 1) {
          await deleteMediaFile(mediaFiles[i].path)
        }

        removeItem(CURRENT_USER_KEY)

        const app = getApp()
        app.globalData = app.globalData || {}
        app.globalData.appSettings = { ...DEFAULT_SETTINGS }

        this.showToast('已注销', 'success')
        setTimeout(() => {
          uni.reLaunch({
            url: '/pages/login/login'
          })
        }, 300)
      } finally {
        uni.hideLoading()
      }
    }
  }
}
</script>

<style scoped>
.setting-page {
  min-height: 100vh;
  background: var(--bg-color);
  padding: 24rpx;
  box-sizing: border-box;
  font-size: var(--page-font-size);

  --mint-card: var(--card-bg-color);
  --mint-title: var(--text-color);
  --mint-sub: var(--text-secondary-color);
  --mint-border: #cdeee2;
  --mint-shadow: 0 10rpx 24rpx rgba(43, 132, 112, 0.12);
  --mint-danger: #e86a70;
}

.setting-scroll {
  max-height: calc(100vh - 48rpx);
}

.group-card {
  background: var(--mint-card);
  border: 2rpx solid var(--mint-border);
  border-radius: 24rpx;
  box-shadow: var(--mint-shadow);
  padding: 22rpx;
  margin-bottom: 18rpx;
}

.group-title {
  display: block;
  font-size: calc(30rpx * var(--font-scale));
  color: var(--mint-title);
  font-weight: 700;
  margin-bottom: 14rpx;
}

.row {
  min-height: 78rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 0;
  gap: 16rpx;
}

.row-left {
  flex: 1;
  min-width: 0;
}

.row-label {
  font-size: calc(28rpx * var(--font-scale));
  color: var(--mint-title);
}

.row-desc {
  display: block;
  margin-top: 6rpx;
  font-size: calc(22rpx * var(--font-scale));
  color: var(--mint-sub);
}

.row-value,
.picker-value {
  font-size: calc(26rpx * var(--font-scale));
  color: var(--mint-sub);
}

.picker-row {
  border: 2rpx solid var(--mint-border);
  border-radius: 14rpx;
  padding: 0 18rpx;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 10rpx;
}

.action-btn {
  flex: 1;
  height: 74rpx;
  line-height: 74rpx;
  margin: 0;
  border-radius: 14rpx;
  font-size: calc(26rpx * var(--font-scale));
  color: #2fa184;
  background: #e9faf4;
  border: 2rpx solid var(--mint-border);
}

.action-btn.warn {
  color: #ffffff;
  background: #2fa184;
}

.action-btn::after {
  border: none;
}

.action-btn[disabled] {
  opacity: 0.5;
}

.logout-btn {
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 14rpx;
  border: none;
  color: #ffffff;
  background: var(--mint-danger);
  font-size: calc(30rpx * var(--font-scale));
  font-weight: 600;
}

.logout-btn::after {
  border: none;
}

@media (prefers-color-scheme: dark) {
  .setting-page {
    --mint-bg: #10241f;
    --mint-card: #173730;
    --mint-title: #def5ee;
    --mint-sub: #92b9af;
    --mint-border: #2b5950;
    --mint-shadow: 0 10rpx 24rpx rgba(0, 0, 0, 0.34);
  }

  .picker-row,
  .action-btn {
    background: #1d433a;
  }
}
</style>
