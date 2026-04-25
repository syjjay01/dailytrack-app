<template>
  <view class="video-player-page" :style="pageStyleVars">
    <view class="player-shell">
      <video
        id="standaloneVideoPlayer"
        class="standalone-video"
        :src="videoSrc"
        :autoplay="true"
        :controls="true"
        objectFit="contain"
        show-center-play-btn
        enable-progress-gesture
      ></video>
    </view>

    <view class="player-meta">
      <text class="player-tip">应用内播放，不会离开当前 APP</text>
      <text class="player-duration">时长 {{ displayDuration }}</text>
    </view>

    <button class="save-video-btn" @click="saveVideo">保存到相册</button>
  </view>
</template>

<script>
import { getThemeVars, getFontConfig, applyNavigationBarTheme } from '@/utils/theme.js'

export default {
  data() {
    return {
      videoSrc: '',
      duration: 0,
      activeThemeVars: getThemeVars('mint'),
      activeFontConfig: getFontConfig('normal')
    }
  },
  computed: {
    pageStyleVars() {
      return {
        ...this.activeThemeVars,
        '--page-font-size': this.activeFontConfig.varSize,
        '--font-scale': String(this.activeFontConfig.scale)
      }
    },
    displayDuration() {
      const total = Number(this.duration || 0)
      const m = Math.floor(total / 60)
      const s = Math.floor(total % 60)
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
  },
  onLoad(options) {
    this.videoSrc = decodeURIComponent((options && options.src) || '')
    this.duration = Number(decodeURIComponent((options && options.duration) || '0')) || 0
  },
  onShow() {
    this.loadAppAppearance()
  },
  methods: {
    loadAppAppearance() {
      const app = getApp()
      const globalData = (app && app.globalData) || {}
      const activeTheme = globalData.activeTheme || 'mint'
      this.activeThemeVars = globalData.themeVars || getThemeVars(activeTheme)
      this.activeFontConfig = globalData.fontConfig || getFontConfig((globalData.appSettings && globalData.appSettings.fontSize) || 'normal')
      applyNavigationBarTheme(activeTheme)
    },
    showToast(title, icon = 'none') {
      uni.showToast({ title, icon, duration: 1800 })
    },
    handleAlbumSaveFail(error) {
      const errMsg = (error && error.errMsg) || ''
      const denied = errMsg.includes('auth deny') || errMsg.includes('authorize no response') || errMsg.includes('permission')
      if (!denied) {
        this.showToast('视频保存失败')
        return
      }
      uni.showModal({
        title: '需要相册权限',
        content: '保存视频到系统相册需要授权，是否前往设置开启？',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm && typeof uni.openSetting === 'function') {
            uni.openSetting({})
          }
        }
      })
    },
    saveVideo() {
      if (!this.videoSrc) {
        this.showToast('视频不存在')
        return
      }
      uni.showLoading({ title: '保存中...' })
      uni.saveVideoToPhotosAlbum({
        filePath: this.videoSrc,
        success: () => {
          this.showToast('视频已保存', 'success')
        },
        fail: (err) => {
          this.handleAlbumSaveFail(err)
        },
        complete: () => {
          uni.hideLoading()
        }
      })
    }
  }
}
</script>

<style scoped>
.video-player-page {
  min-height: 100vh;
  padding: 28rpx 24rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: var(--bg-color, linear-gradient(180deg, #f4fffb 0%, #eefbf7 100%));
}

.player-shell {
  width: 100%;
  border-radius: 28rpx;
  overflow: hidden;
  background: #000000;
  box-shadow: 0 14rpx 36rpx rgba(37, 138, 112, 0.14);
}

.standalone-video {
  width: 100%;
  height: 420rpx;
  display: block;
  background: #000000;
}

.player-meta {
  margin-top: 22rpx;
  padding: 22rpx 24rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.82);
  border: 2rpx solid rgba(88, 196, 166, 0.18);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
}

.player-tip {
  flex: 1;
  font-size: calc(26rpx * var(--font-scale));
  color: var(--text-color, #355b51);
}

.player-duration {
  font-size: calc(24rpx * var(--font-scale));
  color: var(--primary-color, #2fa184);
  font-weight: 600;
}

.save-video-btn {
  margin-top: 26rpx;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 999rpx;
  border: none;
  color: #ffffff;
  font-size: calc(30rpx * var(--font-scale));
  font-weight: 600;
  background: linear-gradient(120deg, var(--primary-color, #2fa184) 0%, var(--mint-primary-2, #58c4a6) 100%);
  box-shadow: 0 14rpx 28rpx rgba(47, 161, 132, 0.22);
}

.save-video-btn::after {
  border: none;
}
</style>
