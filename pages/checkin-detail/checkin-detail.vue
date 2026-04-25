<template>
  <view class="detail-page" :style="pageStyleVars">
    <scroll-view class="content" scroll-y>
      <view class="header-card">
        <text class="task-name">{{ taskName }}</text>
        <text class="date-text">{{ displayDate }}</text>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">录音（10分钟内）</text>
          <text class="section-tip">{{ recordingDurationText }}</text>
        </view>
        <button
          v-if="!audio.path"
          class="audio-record-btn"
          :class="{ recording: recording }"
          @click="recording ? stopRecordAudio() : startRecordAudio()"
        >
          <text v-if="recording" class="recording-loader"></text>
          <text>{{ recording ? '录音中，点击结束并保存' : '开始录音' }}</text>
        </button>
        <view v-else class="audio-file-row">
          <text class="audio-action-icon" @click="onAudioActionTap">{{ audioActionIcon }}</text>
          <view class="audio-file-main">
            <text class="audio-file-name">语音打卡录音</text>
            <text class="audio-file-meta">{{ formatDuration(audio.duration) }}</text>
          </view>
          <text class="audio-delete-text" @click="removeAudio">删除</text>
        </view>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">打卡文字</text>
          <button class="mini-action-btn" :class="{ active: recognizing }" @click="toggleSpeechRecognize">
            {{ recognizing ? '停止识别' : '语音识别' }}
          </button>
        </view>
        <textarea
          v-model="checkinText"
          class="text-input"
          placeholder="记录一下今天的完成情况..."
        />
      </view>

      <view class="section-card">
        <text class="section-title">媒体上传（二选一）</text>

        <view class="upload-actions">
          <button class="upload-btn" :disabled="videoExists" @click="chooseImageFlow">上传图片 ({{ images.length }}/3)</button>
          <button class="upload-btn" :disabled="imageExists" @click="chooseVideoFlow">上传视频</button>
        </view>

        <text v-if="videoExists" class="hint">当前已有视频，如需上传图片请先删除视频</text>
        <text v-if="videoExists" class="switch-link" @click="switchToImageUpload">改为上传图片</text>
        <text v-if="imageExists" class="hint">当前已有图片，如需上传视频请先删除图片</text>
        <text v-if="imageExists" class="switch-link" @click="switchToVideoUpload">改为上传视频</text>

        <view v-if="images.length > 0" class="media-list">
          <view v-for="(img, index) in images" :key="img" class="image-item">
            <image :src="img" class="thumb" mode="aspectFill" @click.stop="previewImage(index)" />
            <text class="save-icon" @click.stop="saveImage(index)">↓</text>
            <text class="delete-icon" @click="removeImage(index)">✕</text>
            <view class="sort-controls">
              <text class="sort-btn" :class="{ disabled: index === 0 }" @click="moveImage(index, -1)">←</text>
              <text class="sort-btn" :class="{ disabled: index === images.length - 1 }" @click="moveImage(index, 1)">→</text>
            </view>
          </view>
        </view>

        <view v-if="video.path" class="video-wrap">
          <!-- #ifdef APP-PLUS -->
          <view
            class="video-preview-card"
            :style="{ width: `${videoWidthPx}px`, height: `${videoHeightPx}px` }"
            @click="previewVideo"
          >
            <view class="video-preview-play">▶</view>
            <text class="video-preview-tip">点击播放视频</text>
            <text class="video-preview-duration">{{ formatDuration(video.duration) }}</text>
          </view>
          <!-- #endif -->
          <!-- #ifndef APP-PLUS -->
          <view class="video-frame" :style="{ width: `${videoWidthPx}px`, height: `${videoHeightPx}px` }">
            <video
              id="checkinVideoPlayer"
              :src="video.path"
              class="video-player"
              :style="{ width: `${videoWidthPx}px`, height: `${videoHeightPx}px` }"
              :controls="true"
              objectFit="cover"
              @tap.stop="openVideoFullscreen"
              @ended="onVideoEnded"
              @play="onVideoPlay"
            ></video>
          </view>
          <!-- #endif -->
          <view class="video-info">
            <text>视频时长：{{ formatDuration(video.duration) }}</text>
            <text class="delete-video" @click="removeVideo">删除视频</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <button class="save-btn" :disabled="saving" @click="handleSave">保存</button>
    </view>
  </view>
</template>

<script>
import { getDailyRecord, setDailyRecord, getItem, removeItem } from '@/utils/storage.js'
import { formatDate, getWeekday } from '@/utils/dateHelper.js'
import { compressAndSaveImage, validateAndSaveVideo, deleteMediaFile } from '@/utils/mediaHelper.js'
import { getThemeVars, getFontConfig, applyNavigationBarTheme } from '@/utils/theme.js'

const EDITING_TASK_SNAPSHOT_KEY = 'editingTaskSnapshot'

export default {
  data() {
    return {
      date: '',
      taskId: '',
      taskName: '任务详情',
      checkinText: '',
      images: [],
      video: {
        path: '',
        duration: 0
      },
      audio: {
        path: '',
        duration: 0
      },
      recording: false,
      audioPlaying: false,
      audioEnded: false,
      recordingElapsedSec: 0,
      recordingTimer: null,
      recognizing: false,
      recordStartAt: 0,
      videoEnded: false,
      mediaType: '',
      saving: false,
      videoWidthPx: 320,
      videoHeightPx: 210,
      allowLeave: false,
      initialSnapshot: '',
      ignoreNextRecordSave: false,
      activeThemeVars: getThemeVars('mint'),
      activeFontConfig: getFontConfig('normal'),
      recorderManager: null,
      audioPlayer: null
    }
  },
  computed: {
    displayDate() {
      if (!this.date) {
        return ''
      }
      const day = formatDate(this.date, 'YYYY年MM月DD日')
      return `${day} ${getWeekday(this.date).replace('周', '星期')}`
    },
    imageExists() {
      return this.images.length > 0
    },
    videoExists() {
      return !!this.video.path
    },
    audioActionIcon() {
      if (this.audioPlaying) {
        return '⏸'
      }
      if (this.audioEnded) {
        return '↻'
      }
      return '▶'
    },
    recordingDurationText() {
      if (this.recording) {
        return this.formatDuration(this.recordingElapsedSec)
      }
      return this.formatDuration(this.audio.duration)
    },
    pageStyleVars() {
      return {
        ...this.activeThemeVars,
        '--page-font-size': this.activeFontConfig.varSize,
        '--font-scale': String(this.activeFontConfig.scale)
      }
    }
  },
  onLoad(options) {
    this.date = options.date || ''
    this.taskId = options.taskId || ''
    this.initVideoLayout()
    this.initAudioTools()
    this.loadTaskDetail()
  },
  onShow() {
    this.loadAppAppearance()
  },
  onBackPress() {
    if (this.allowLeave) {
      return false
    }
    if (!this.hasPendingChanges()) {
      return false
    }
    this.confirmLeaveWithoutSave()
    return true
  },
  onUnload() {
    if (this.recording) {
      this.stopRecordAudio()
    }
    this.stopRecordingTimer()
    if (this.audioPlayer) {
      this.audioPlayer.stop()
      this.audioPlayer.destroy()
      this.audioPlayer = null
    }
    this.stopSpeechRecognize(true)
  },
  methods: {
    initVideoLayout() {
      try {
        const info = uni.getSystemInfoSync()
        const width = Number((info && info.windowWidth) || 375)
        const contentWidth = Math.max(240, width - 44)
        const w = Math.min(520, contentWidth)
        const h = Math.round((w * 9) / 16)
        this.videoWidthPx = w
        this.videoHeightPx = Math.min(280, Math.max(170, h))
      } catch (error) {
        this.videoWidthPx = 320
        this.videoHeightPx = 210
      }
    },
    refreshVideoLayoutByContainer() {
      this.$nextTick(() => {
        const query = uni.createSelectorQuery().in(this)
        query.select('.video-wrap').boundingClientRect()
        query.exec((res) => {
          const rect = res && res[0]
          if (!rect || !rect.width) {
            return
          }
          const w = Math.max(240, Math.floor(rect.width))
          const h = Math.round((w * 9) / 16)
          this.videoWidthPx = w
          this.videoHeightPx = Math.min(280, Math.max(170, h))
        })
      })
    },
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
    buildSnapshot() {
      return JSON.stringify({
        checkinText: String(this.checkinText || ''),
        images: Array.isArray(this.images) ? this.images.slice() : [],
        videoPath: this.video && this.video.path ? this.video.path : '',
        videoDuration: Number((this.video && this.video.duration) || 0),
        audioPath: this.audio && this.audio.path ? this.audio.path : '',
        audioDuration: Number((this.audio && this.audio.duration) || 0),
        mediaType: this.mediaType || ''
      })
    },
    markInitialSnapshot() {
      this.initialSnapshot = this.buildSnapshot()
    },
    hasPendingChanges() {
      if (this.recording || this.recognizing) {
        return true
      }
      return this.buildSnapshot() !== this.initialSnapshot
    },
    confirmLeaveWithoutSave() {
      uni.showModal({
        title: '有未保存内容',
        content: '你有未保存的修改，确定不保存直接退出吗？',
        confirmText: '继续编辑',
        cancelText: '直接退出',
        success: (res) => {
          if (res.confirm) {
            return
          }
          this.allowLeave = true
          if (this.recording && this.recorderManager) {
            this.ignoreNextRecordSave = true
            this.stopRecordAudio()
          }
          this.stopSpeechRecognize(true)
          setTimeout(() => {
            uni.navigateBack()
          }, 50)
        }
      })
    },
    initAudioTools() {
      if (typeof uni.getRecorderManager === 'function') {
        this.recorderManager = uni.getRecorderManager()
        this.recorderManager.onStop(async (res) => {
          this.recording = false
          this.stopRecordingTimer()
          if (this.ignoreNextRecordSave) {
            this.ignoreNextRecordSave = false
            return
          }
          const tempPath = (res && res.tempFilePath) || ''
          if (!tempPath) {
            this.showToast('录音保存失败')
            return
          }
          try {
            if (this.audio.path) {
              await deleteMediaFile(this.audio.path)
            }
            const saved = await this.saveAudioTempFile(tempPath)
            const durationMs = Number((res && res.duration) || Date.now() - this.recordStartAt || 0)
            this.audio = {
              path: saved,
              duration: Math.max(1, Math.floor(durationMs / 1000))
            }
            this.recordingElapsedSec = 0
            this.audioEnded = false
            this.showToast('录音已保存', 'success')
          } catch (error) {
            this.showToast('录音保存失败')
          }
        })
        this.recorderManager.onError(() => {
          this.recording = false
          this.stopRecordingTimer()
          this.recordingElapsedSec = 0
          this.showToast('录音失败')
        })
      }
      this.audioPlayer = uni.createInnerAudioContext()
      this.audioPlayer.onPlay(() => {
        this.audioPlaying = true
        this.audioEnded = false
      })
      this.audioPlayer.onPause(() => {
        this.audioPlaying = false
      })
      this.audioPlayer.onStop(() => {
        this.audioPlaying = false
      })
      this.audioPlayer.onEnded(() => {
        this.audioPlaying = false
        this.audioEnded = true
      })
      this.audioPlayer.onError(() => {
        this.audioPlaying = false
        this.showToast('音频播放失败')
      })
    },
    saveAudioTempFile(tempFilePath) {
      return new Promise((resolve, reject) => {
        uni.saveFile({
          tempFilePath,
          success: (res) => {
            if (res && res.savedFilePath) {
              resolve(res.savedFilePath)
              return
            }
            reject(new Error('SAVE_AUDIO_FAIL'))
          },
          fail: (err) => reject(err)
        })
      })
    },
    pickFirstValid(...values) {
      for (let i = 0; i < values.length; i += 1) {
        const v = values[i]
        if (v === undefined || v === null) {
          continue
        }
        if (typeof v === 'string') {
          if (v.length > 0) {
            return v
          }
          continue
        }
        if (typeof v === 'number') {
          return String(v)
        }
      }
      return ''
    },
    parseMaybeObject(value) {
      if (!value) {
        return {}
      }
      if (typeof value === 'object') {
        return value
      }
      if (typeof value === 'string') {
        let current = value
        for (let i = 0; i < 3; i += 1) {
          try {
            const parsed = JSON.parse(current)
            if (parsed && typeof parsed === 'object') {
              return parsed
            }
            if (typeof parsed === 'string') {
              current = parsed
              continue
            }
            return {}
          } catch (error) {
            return {}
          }
        }
      }
      return {}
    },
    pickTextByPattern(obj, pattern) {
      if (!obj || typeof obj !== 'object') {
        return ''
      }
      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        if (!pattern.test(String(key))) {
          continue
        }
        const val = obj[key]
        if (typeof val === 'string' && val.trim()) {
          return val
        }
      }
      return ''
    },
    extractLikelyTextDeep(source, depth = 0) {
      if (depth > 4 || source === null || source === undefined) {
        return ''
      }
      if (typeof source === 'string') {
        const parsed = this.parseMaybeObject(source)
        if (parsed && Object.keys(parsed).length > 0) {
          const nested = this.extractLikelyTextDeep(parsed, depth + 1)
          if (nested) {
            return nested
          }
        }
        const text = source.trim()
        return text ? source : ''
      }
      if (typeof source !== 'object') {
        return ''
      }
      if (Array.isArray(source)) {
        for (let i = 0; i < source.length; i += 1) {
          const found = this.extractLikelyTextDeep(source[i], depth + 1)
          if (found) {
            return found
          }
        }
        return ''
      }

      const keys = Object.keys(source)
      // 1) 优先命中明显是文本含义的 key。
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const value = source[key]
        if (!/(text|content|remark|note|desc|memo|message|detail|body|comment)/i.test(String(key))) {
          continue
        }
        if (typeof value === 'string' && value.trim()) {
          return value
        }
      }

      // 2) 再递归子对象。
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const value = source[key]
        if (value && typeof value === 'object') {
          const found = this.extractLikelyTextDeep(value, depth + 1)
          if (found) {
            return found
          }
        }
      }

      // 3) 最后兜底：取非路径类 key 的字符串字段。
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        if (/(path|url|video|audio|image|id|name|status|type|date|time)/i.test(String(key))) {
          continue
        }
        const value = source[key]
        if (typeof value === 'string' && value.trim()) {
          return value
        }
      }

      return ''
    },
    resolveTaskText(task) {
      const base = this.parseMaybeObject(task)
      const source = base && Object.keys(base).length > 0 ? base : (task || {})
      const checkin = this.parseMaybeObject(source && source.checkin)
      const detail = this.parseMaybeObject(source && source.detail)
      const record = this.parseMaybeObject(source && source.record)
      const direct = this.pickFirstValid(
        source && source.checkinText,
        source && source.text,
        source && source.content,
        source && source.checkinContent,
        source && source.checkin_content,
        source && source.note,
        source && source.remark,
        source && source.description,
        source && source.desc,
        checkin && checkin.text,
        checkin && checkin.content,
        checkin && checkin.checkinText,
        detail && detail.text,
        detail && detail.content,
        record && record.text,
        record && record.content
      )
      if (direct) {
        return direct
      }
      const fuzzy = this.pickFirstValid(
        this.pickTextByPattern(source, /(text|content|remark|note|desc)/i),
        this.pickTextByPattern(checkin, /(text|content|remark|note|desc)/i),
        this.pickTextByPattern(detail, /(text|content|remark|note|desc)/i),
        this.pickTextByPattern(record, /(text|content|remark|note|desc)/i)
      )
      if (fuzzy) {
        return fuzzy
      }
      return this.pickFirstValid(
        this.extractLikelyTextDeep(source),
        this.extractLikelyTextDeep(checkin),
        this.extractLikelyTextDeep(detail),
        this.extractLikelyTextDeep(record)
      )
    },
    resolveTaskImages(task) {
      const checkin = this.parseMaybeObject(task && task.checkin)
      const detail = this.parseMaybeObject(task && task.detail)
      const src = Array.isArray(task && task.images)
        ? task.images
        : Array.isArray(task && task.checkinImages)
          ? task.checkinImages
          : Array.isArray(task && task.mediaImages)
            ? task.mediaImages
            : Array.isArray(task && task.media && task.media.images)
              ? task.media.images
            : Array.isArray(checkin && checkin.images)
              ? checkin.images
              : Array.isArray(detail && detail.images)
                ? detail.images
                : []
      return src.slice(0, 3)
    },
    resolveTaskVideo(task) {
      const checkin = this.parseMaybeObject(task && task.checkin)
      const detail = this.parseMaybeObject(task && task.detail)
      return {
        path: this.pickFirstValid(
          task && task.video,
          task && task.videoPath,
          task && task.mediaVideoPath,
          task && task.mediaVideo,
          task && task.media && task.media.video,
          checkin && checkin.video,
          detail && detail.video
        ),
        duration: Number(
          task && task.videoDuration !== undefined
            ? task.videoDuration
            : task && task.video_duration !== undefined
              ? task.video_duration
              : checkin && checkin.videoDuration !== undefined
                ? checkin.videoDuration
                : detail && detail.videoDuration !== undefined
                  ? detail.videoDuration
                : 0
        )
      }
    },
    resolveTaskAudio(task) {
      const checkin = this.parseMaybeObject(task && task.checkin)
      const detail = this.parseMaybeObject(task && task.detail)
      const record = this.parseMaybeObject(task && task.record)
      return {
        path: this.pickFirstValid(
          task && task.audioPath,
          task && task.audio,
          task && task.recordPath,
          task && task.voicePath,
          task && task.voice,
          task && task.media && task.media.audio,
          checkin && checkin.audio,
          detail && detail.audio,
          record && record.audio,
          record && record.path
        ),
        duration: Number(
          task && task.audioDuration !== undefined
            ? task.audioDuration
            : task && task.audio_duration !== undefined
              ? task.audio_duration
              : checkin && checkin.audioDuration !== undefined
                ? checkin.audioDuration
                : detail && detail.audioDuration !== undefined
                  ? detail.audioDuration
                  : record && record.duration !== undefined
                    ? record.duration
                : 0
        )
      }
    },
    startRecordingTimer() {
      this.stopRecordingTimer()
      this.recordingElapsedSec = 0
      this.recordingTimer = setInterval(() => {
        this.recordingElapsedSec += 1
        if (this.recordingElapsedSec >= 600) {
          this.stopRecordAudio()
        }
      }, 1000)
    },
    stopRecordingTimer() {
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }
    },
    loadTaskDetail() {
      if (!this.date || !this.taskId) {
        this.showToast('参数错误')
        setTimeout(() => {
          uni.navigateBack()
        }, 300)
        return
      }

      const dailyList = getDailyRecord(this.date)
      let task = dailyList.find((item) => String(item && item.id) === String(this.taskId))
      const snapshot = getItem(EDITING_TASK_SNAPSHOT_KEY)
      const snapshotMatched =
        snapshot &&
        String(snapshot.date || '') === String(this.date) &&
        String(snapshot.taskId || '') === String(this.taskId) &&
        snapshot.task

      if ((!task || !this.resolveTaskText(task)) && snapshotMatched) {
        const taskObj = this.parseMaybeObject(task)
        const snapshotObj = this.parseMaybeObject(snapshot.task)
        task = task ? { ...snapshotObj, ...taskObj } : { ...snapshotObj }
      }

      // 放宽兜底：即便 taskId 不一致，只要来自同一天且当前任务文本为空，也使用最近一次点击任务快照补回显。
      if ((!task || !this.resolveTaskText(task)) && snapshot && String(snapshot.date || '') === String(this.date) && snapshot.task) {
        const taskObj = this.parseMaybeObject(task)
        const snapshotObj = this.parseMaybeObject(snapshot.task)
        task = task ? { ...snapshotObj, ...taskObj } : { ...snapshotObj }
      }

      if (!task) {
        this.showToast('任务不存在')
        setTimeout(() => {
          uni.navigateBack()
        }, 300)
        return
      }

      const taskObj = this.parseMaybeObject(task)
      const effectiveTask = taskObj && Object.keys(taskObj).length > 0 ? taskObj : task

      this.taskName = (effectiveTask && effectiveTask.name) || '任务详情'
      this.checkinText = this.resolveTaskText(effectiveTask)
      this.images = this.resolveTaskImages(effectiveTask)
      this.video = this.resolveTaskVideo(effectiveTask)
      this.audio = this.resolveTaskAudio(effectiveTask)
      this.audioEnded = false
      this.mediaType = (effectiveTask && effectiveTask.mediaType) || (this.images.length ? 'image' : this.video.path ? 'video' : '')
      if (this.video.path) {
        this.refreshVideoLayoutByContainer()
      }
      this.markInitialSnapshot()
      removeItem(EDITING_TASK_SNAPSHOT_KEY)
    },
    async clearImages(deleteLocal = true) {
      const paths = this.images.slice()
      this.images = []
      this.mediaType = this.video.path ? 'video' : ''
      if (!deleteLocal) {
        return
      }
      await Promise.all(paths.map((path) => deleteMediaFile(path)))
    },
    async clearVideo(deleteLocal = true) {
      const path = this.video.path
      this.video = { path: '', duration: 0 }
      this.videoEnded = false
      this.mediaType = this.images.length ? 'image' : ''
      if (deleteLocal && path) {
        await deleteMediaFile(path)
      }
    },
    confirmSwitchMedia(content) {
      return new Promise((resolve) => {
        uni.showModal({
          title: '切换媒体类型',
          content,
          confirmText: '清空并继续',
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false)
        })
      })
    },
    async switchToImageUpload() {
      if (!this.videoExists) {
        this.chooseImageFlow()
        return
      }
      const confirmed = await this.confirmSwitchMedia('将清空当前视频后上传图片，是否继续？')
      if (!confirmed) {
        return
      }
      await this.clearVideo(true)
      this.chooseImageFlow()
    },
    async switchToVideoUpload() {
      if (!this.imageExists) {
        this.chooseVideoFlow()
        return
      }
      const confirmed = await this.confirmSwitchMedia('将清空当前图片后上传视频，是否继续？')
      if (!confirmed) {
        return
      }
      await this.clearImages(true)
      this.chooseVideoFlow()
    },
    startRecordAudio() {
      if (!this.recorderManager) {
        this.showToast('当前平台不支持录音')
        return
      }
      const start = async () => {
        if (this.audio.path) {
          await deleteMediaFile(this.audio.path)
        }
        if (this.audioPlayer) {
          this.audioPlayer.stop()
        }
        this.audio = { path: '', duration: 0 }
        this.audioEnded = false
        this.audioPlaying = false
        this.recordingElapsedSec = 0
        this.recordStartAt = Date.now()
        this.recording = true
        this.startRecordingTimer()
        this.recorderManager.start({
          duration: 600000,
          format: 'mp3'
        })
      }
      if (!this.audio.path) {
        start()
        return
      }
      uni.showModal({
        title: '重新录音',
        content: '重新录音会覆盖当前录音，是否继续？',
        success: async (res) => {
          if (!res.confirm) {
            return
          }
          await start()
        }
      })
    },
    stopRecordAudio() {
      if (!this.recording || !this.recorderManager) {
        return
      }
      this.recorderManager.stop()
    },
    togglePlayAudio() {
      if (!this.audio.path || !this.audioPlayer) {
        return
      }
      if (this.audioPlaying) {
        this.audioPlayer.pause()
        return
      }
      this.audioPlayer.src = this.audio.path
      this.audioPlayer.play()
      this.audioEnded = false
    },
    replayAudio() {
      if (!this.audio.path || !this.audioPlayer) {
        return
      }
      this.audioPlayer.stop()
      this.audioPlayer.src = this.audio.path
      this.audioPlayer.play()
      this.audioEnded = false
    },
    onAudioActionTap() {
      if (!this.audio.path) {
        return
      }
      if (this.audioPlaying) {
        this.togglePlayAudio()
        return
      }
      if (this.audioEnded) {
        this.replayAudio()
        return
      }
      this.togglePlayAudio()
    },
    async removeAudio() {
      if (!this.audio.path) {
        return
      }
      uni.showModal({
        title: '删除录音',
        content: '确定删除当前录音吗？',
        success: async (res) => {
          if (!res.confirm) {
            return
          }
          if (this.audioPlayer) {
            this.audioPlayer.stop()
          }
          await deleteMediaFile(this.audio.path)
          this.audio = { path: '', duration: 0 }
          this.audioPlaying = false
          this.audioEnded = false
          this.showToast('录音已删除', 'success')
        }
      })
    },
    toggleSpeechRecognize() {
      if (this.recognizing) {
        this.stopSpeechRecognize()
        return
      }
      this.startSpeechRecognize()
    },
    startSpeechRecognize() {
      // #ifdef APP-PLUS
      if (!plus || !plus.speech || typeof plus.speech.startRecognize !== 'function') {
        this.showToast('当前设备不支持语音识别')
        return
      }
      this.recognizing = true
      plus.speech.startRecognize(
        {
          timeout: 0,
          punctuation: true,
          continue: true
        },
        (result) => {
          this.recognizing = false
          const text = String(result || '').trim()
          if (!text) {
            this.showToast('未识别到语音')
            return
          }
          this.checkinText = `${this.checkinText || ''}${this.checkinText ? '\n' : ''}${text}`
          this.showToast('识别完成', 'success')
        },
        () => {
          this.recognizing = false
          this.showToast('语音识别失败')
        }
      )
      // #endif

      // #ifndef APP-PLUS
      this.showToast('当前平台暂不支持语音识别')
      // #endif
    },
    stopSpeechRecognize(silent = false) {
      // #ifdef APP-PLUS
      if (plus && plus.speech && typeof plus.speech.stopRecognize === 'function') {
        plus.speech.stopRecognize()
      }
      // #endif
      if (this.recognizing && !silent) {
        this.showToast('已停止识别')
      }
      this.recognizing = false
    },
    chooseImageFlow() {
      if (this.images.length >= 3) {
        this.showToast('最多上传3张图片')
        return
      }

      const count = 3 - this.images.length
      uni.chooseImage({
        count,
        sizeType: ['compressed', 'original'],
        success: async (res) => {
          const tempFiles = res.tempFilePaths || []
          if (!tempFiles.length) {
            return
          }

          uni.showLoading({ title: '处理图片中...' })
          try {
            const result = []
            for (let i = 0; i < tempFiles.length; i += 1) {
              const savedPath = await compressAndSaveImage(tempFiles[i], 5)
              result.push(savedPath)
            }
            this.images = [...this.images, ...result].slice(0, 3)
            this.mediaType = this.images.length > 0 ? 'image' : ''
            this.showToast('图片已添加', 'success')
          } catch (error) {
            this.showToast('图片处理失败')
          } finally {
            uni.hideLoading()
          }
        }
      })
    },
    chooseVideoFlow() {
      uni.showActionSheet({
        itemList: ['录制视频（最长5分钟）', '从本地视频选择'],
        success: (sheetRes) => {
          const useCamera = sheetRes.tapIndex === 0
          this.chooseVideoBySource(useCamera)
        }
      })
    },
    chooseVideoBySource(useCamera = false) {
      const chooseOptions = {
        sourceType: useCamera ? ['camera'] : ['album'],
        compressed: false,
        success: async (res) => {
          if (!res.tempFilePath) {
            return
          }

          uni.showLoading({ title: '处理视频中...' })
          try {
            if (this.video.path) {
              const confirmed = await this.confirmSwitchMedia('将覆盖当前视频，是否继续？')
              if (!confirmed) {
                uni.hideLoading()
                return
              }
              await this.clearVideo(true)
            }

            const maxDurationSec = useCamera ? 300 : Number.MAX_SAFE_INTEGER
            const savedPath = await validateAndSaveVideo(
              {
                tempFilePath: res.tempFilePath,
                duration: res.duration,
                size: res.size
              },
              maxDurationSec,
              500
            )
            this.video = {
              path: savedPath,
              duration: Number(res.duration || 0)
            }
            this.videoEnded = false
            this.mediaType = 'video'
            this.refreshVideoLayoutByContainer()
            this.showToast('视频已添加', 'success')
          } catch (error) {
            if (error && error.message === 'VIDEO_SIZE_EXCEEDED') {
              this.showToast('视频不能超过500MB')
            } else if (error && error.message === 'VIDEO_DURATION_EXCEEDED') {
              this.showToast('录制视频最长5分钟')
            } else {
              this.showToast('视频处理失败')
            }
          } finally {
            uni.hideLoading()
          }
        }
      }
      if (useCamera) {
        chooseOptions.maxDuration = 300
      }
      uni.chooseVideo(chooseOptions)
    },
    async removeImage(index) {
      if (index < 0 || index >= this.images.length) {
        return
      }
      const target = this.images[index]
      this.images.splice(index, 1)
      await deleteMediaFile(target)
      if (this.images.length === 0) {
        this.mediaType = ''
      }
    },
    async removeVideo() {
      if (!this.video.path) {
        return
      }
      uni.showModal({
        title: '删除视频',
        content: '确定删除当前视频吗？',
        confirmText: '删除',
        success: async (res) => {
          if (!res.confirm) {
            return
          }
          await this.clearVideo(true)
          this.showToast('视频已删除', 'success')
        }
      })
    },
    moveImage(index, offset) {
      const toIndex = index + offset
      if (toIndex < 0 || toIndex >= this.images.length) {
        return
      }
      const list = this.images.slice()
      const temp = list[index]
      list[index] = list[toIndex]
      list[toIndex] = temp
      this.images = list
    },
    previewImage(index) {
      if (!Array.isArray(this.images) || this.images.length === 0) {
        return
      }
      uni.previewImage({
        current: this.images[index] || this.images[0],
        urls: this.images.slice()
      })
    },
    saveImage(index) {
      const path = this.images[index]
      if (!path) {
        this.showToast('图片不存在')
        return
      }
      uni.showLoading({ title: '保存中...' })
      uni.saveImageToPhotosAlbum({
        filePath: path,
        success: () => {
          this.showToast('图片已保存', 'success')
        },
        fail: (err) => {
          this.handleAlbumSaveFail(err, '图片')
        },
        complete: () => {
          uni.hideLoading()
        }
      })
    },
    formatDuration(duration) {
      const total = Number(duration || 0)
      const m = Math.floor(total / 60)
      const s = Math.floor(total % 60)
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    },
    getVideoContext() {
      return uni.createVideoContext('checkinVideoPlayer', this)
    },
    previewVideo() {
      if (!this.video.path) {
        return
      }
      // #ifdef APP-PLUS
      uni.navigateTo({
        url: `/pages/video-player/video-player?src=${encodeURIComponent(this.video.path)}&duration=${encodeURIComponent(String(this.video.duration || 0))}`
      })
      return
      // #endif
      if (typeof uni.previewMedia === 'function') {
        uni.previewMedia({
          current: 0,
          sources: [
            {
              url: this.video.path,
              type: 'video'
            }
          ],
          fail: () => {
            // #ifdef APP-PLUS
            if (typeof plus !== 'undefined' && plus.runtime && typeof plus.runtime.openFile === 'function') {
              plus.runtime.openFile(this.video.path)
              return
            }
            // #endif
            this.showToast('当前设备暂不支持视频预览')
          }
        })
        return
      }
      const ctx = this.getVideoContext()
      if (ctx && typeof ctx.requestFullScreen === 'function') {
        ctx.requestFullScreen({
          direction: 0
        })
        if (typeof ctx.play === 'function') {
          ctx.play()
        }
      }
    },
    playVideo() {
      if (!this.video.path) {
        return
      }
      // #ifdef APP-PLUS
      this.previewVideo()
      return
      // #endif
      const ctx = this.getVideoContext()
      if (ctx && typeof ctx.play === 'function') {
        ctx.play()
      }
    },
    replayVideo() {
      if (!this.video.path) {
        return
      }
      // #ifdef APP-PLUS
      this.videoEnded = false
      this.previewVideo()
      return
      // #endif
      const ctx = this.getVideoContext()
      if (ctx && typeof ctx.seek === 'function') {
        ctx.seek(0)
      }
      if (ctx && typeof ctx.play === 'function') {
        ctx.play()
      }
      this.videoEnded = false
    },
    openVideoFullscreen() {
      if (!this.video.path) {
        return
      }
      // #ifdef APP-PLUS
      this.previewVideo()
      return
      // #endif
      const ctx = this.getVideoContext()
      if (ctx && typeof ctx.requestFullScreen === 'function') {
        ctx.requestFullScreen({
          direction: 0
        })
      }
    },
    onVideoEnded() {
      this.videoEnded = true
    },
    onVideoPlay() {
      this.videoEnded = false
    },
    saveVideo() {
      if (!this.video.path) {
        this.showToast('视频不存在')
        return
      }
      uni.showLoading({ title: '保存中...' })
      uni.saveVideoToPhotosAlbum({
        filePath: this.video.path,
        success: () => {
          this.showToast('视频已保存', 'success')
        },
        fail: (err) => {
          this.handleAlbumSaveFail(err, '视频')
        },
        complete: () => {
          uni.hideLoading()
        }
      })
    },
    handleAlbumSaveFail(error, mediaType) {
      const errMsg = (error && error.errMsg) || ''
      const denied = errMsg.includes('auth deny') || errMsg.includes('authorize no response') || errMsg.includes('permission')
      if (!denied) {
        this.showToast(`${mediaType}保存失败`)
        return
      }
      uni.showModal({
        title: '需要相册权限',
        content: `保存${mediaType}到系统相册需要授权，是否前往设置开启？`,
        confirmText: '去设置',
        success: (res) => {
          if (!res.confirm) {
            return
          }
          if (typeof uni.openSetting === 'function') {
            uni.openSetting({})
          }
        }
      })
    },
    async handleSave() {
      const text = String(this.checkinText || '').trim()
      const hasImage = this.images.length > 0
      const hasVideo = !!this.video.path
      const hasAudio = !!this.audio.path

      if (!text && !hasImage && !hasVideo && !hasAudio) {
        this.showToast('请填写文字或上传内容')
        return
      }

      this.saving = true
      try {
        const dailyList = getDailyRecord(this.date)
        const idx = dailyList.findIndex((item) => String(item.id) === String(this.taskId))
        if (idx < 0) {
          this.showToast('任务不存在')
          return
        }

        const oldTask = dailyList[idx]
        dailyList[idx] = {
          ...oldTask,
          status: 'completed',
          checkinText: text,
          text,
          content: text,
          checkinContent: text,
          images: this.images.slice(),
          checkinImages: this.images.slice(),
          mediaImages: this.images.slice(),
          video: this.video.path,
          videoPath: this.video.path,
          mediaVideoPath: this.video.path,
          mediaVideo: this.video.path,
          videoDuration: this.video.duration,
          audioPath: this.audio.path,
          audio: this.audio.path,
          recordPath: this.audio.path,
          voicePath: this.audio.path,
          voice: this.audio.path,
          audioDuration: this.audio.duration,
          checkin: {
            ...(this.parseMaybeObject(oldTask && oldTask.checkin)),
            text,
            content: text,
            images: this.images.slice(),
            video: this.video.path,
            videoDuration: this.video.duration,
            audio: this.audio.path,
            audioDuration: this.audio.duration
          },
          mediaType: hasImage ? 'image' : hasVideo ? 'video' : ''
        }

        setDailyRecord(this.date, dailyList)
        removeItem(EDITING_TASK_SNAPSHOT_KEY)
        this.showToast('保存成功', 'success')
        this.markInitialSnapshot()
        this.allowLeave = true
        setTimeout(() => {
          uni.navigateBack()
        }, 300)
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--bg-color);
  padding: 24rpx 24rpx 170rpx;
  box-sizing: border-box;
  font-size: var(--page-font-size);

  --mint-card: var(--card-bg-color);
  --mint-title: var(--text-color);
  --mint-sub: var(--text-secondary-color);
  --mint-border: #cdeee2;
  --mint-shadow: 0 10rpx 26rpx rgba(43, 132, 112, 0.12);
  --mint-primary: var(--primary-color);
  --mint-primary-2: var(--primary-color);
  --mint-danger: #e86a70;
}

.content {
  max-height: calc(100vh - 220rpx);
  padding-bottom: 44rpx;
  box-sizing: border-box;
}

.header-card,
.section-card {
  background: var(--mint-card);
  border: 2rpx solid var(--mint-border);
  box-shadow: var(--mint-shadow);
  border-radius: 24rpx;
  padding: 22rpx;
  margin-bottom: 18rpx;
}

.task-name {
  display: block;
  font-size: calc(36rpx * var(--font-scale));
  font-weight: 700;
  color: var(--mint-title);
}

.date-text {
  display: block;
  margin-top: 8rpx;
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-sub);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: calc(30rpx * var(--font-scale));
  color: var(--mint-title);
  font-weight: 600;
}

.section-tip,
.hint {
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-sub);
}

.mini-action-btn {
  margin: 0;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 18rpx;
  border-radius: 12rpx;
  font-size: calc(22rpx * var(--font-scale));
  color: var(--mint-primary-2);
  background: #e9faf4;
  border: 2rpx solid var(--mint-border);
}

.mini-action-btn.active {
  color: #ffffff;
  background: var(--mint-primary);
}

.mini-action-btn::after {
  border: none;
}

.switch-link {
  display: inline-block;
  margin-top: 8rpx;
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-primary-2);
}

.text-input {
  margin-top: 16rpx;
  width: 100%;
  min-height: 220rpx;
  border: 2rpx solid var(--mint-border);
  border-radius: 16rpx;
  box-sizing: border-box;
  padding: 18rpx;
  font-size: calc(28rpx * var(--font-scale));
  color: var(--mint-title);
  background: #f8fffc;
}

.audio-record-btn {
  margin-top: 16rpx;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 14rpx;
  font-size: calc(26rpx * var(--font-scale));
  color: var(--mint-primary-2);
  background: #e9faf4;
  border: 2rpx solid var(--mint-border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.audio-record-btn.recording {
  color: #ffffff;
  background: var(--mint-danger);
  border-color: var(--mint-danger);
}

.audio-record-btn::after {
  border: none;
}

.recording-loader {
  width: 22rpx;
  height: 22rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  animation: spin 1s linear infinite;
}

.audio-file-row {
  margin-top: 16rpx;
  min-height: 84rpx;
  border-radius: 16rpx;
  border: 2rpx solid var(--mint-border);
  background: #f8fffc;
  padding: 0 18rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.audio-action-icon {
  width: 52rpx;
  text-align: center;
  font-size: calc(34rpx * var(--font-scale));
  color: var(--mint-primary-2);
}

.audio-file-main {
  flex: 1;
  min-width: 0;
}

.audio-file-name {
  display: block;
  font-size: calc(26rpx * var(--font-scale));
  color: var(--mint-title);
}

.audio-file-meta {
  display: block;
  margin-top: 4rpx;
  font-size: calc(22rpx * var(--font-scale));
  color: var(--mint-sub);
}

.audio-delete-text {
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-danger);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.upload-actions {
  margin-top: 18rpx;
  display: flex;
  gap: 12rpx;
}

.upload-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 14rpx;
  font-size: calc(26rpx * var(--font-scale));
  margin: 0;
  color: var(--mint-primary-2);
  background: #e9faf4;
  border: 2rpx solid var(--mint-border);
}

.upload-btn::after {
  border: none;
}

.upload-btn[disabled] {
  opacity: 0.45;
}

.hint {
  display: block;
  margin-top: 12rpx;
}

.media-list {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.image-item {
  position: relative;
  width: 200rpx;
}

.thumb {
  width: 200rpx;
  height: 200rpx;
  border-radius: 14rpx;
  border: 2rpx solid var(--mint-border);
}

.delete-icon {
  position: absolute;
  top: -14rpx;
  right: -14rpx;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 24rpx;
  color: #ffffff;
  background: var(--mint-danger);
}

.save-icon {
  position: absolute;
  top: -14rpx;
  left: -14rpx;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 22rpx;
  color: #ffffff;
  background: var(--mint-primary);
}

.sort-controls {
  margin-top: 8rpx;
  display: flex;
  justify-content: center;
  gap: 12rpx;
}

.sort-btn {
  width: 50rpx;
  height: 42rpx;
  line-height: 42rpx;
  text-align: center;
  border-radius: 10rpx;
  background: #edf8f4;
  color: var(--mint-primary-2);
  font-size: 24rpx;
}

.sort-btn.disabled {
  opacity: 0.4;
}

.video-wrap {
  margin-top: 18rpx;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.video-frame {
  border-radius: 16rpx;
  border: 2rpx solid var(--mint-border);
  overflow: hidden;
  background: #000000;
  box-sizing: border-box;
}

.video-preview-card {
  position: relative;
  border-radius: 16rpx;
  border: 2rpx solid var(--mint-border);
  background: linear-gradient(180deg, #101010 0%, #000000 100%);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.video-preview-play {
  width: 108rpx;
  height: 108rpx;
  line-height: 100rpx;
  text-align: center;
  border-radius: 54rpx;
  border: 6rpx solid rgba(255, 255, 255, 0.92);
  color: #ffffff;
  font-size: 48rpx;
  text-indent: 8rpx;
  box-sizing: border-box;
}

.video-preview-tip {
  margin-top: 18rpx;
  font-size: calc(26rpx * var(--font-scale));
  color: rgba(255, 255, 255, 0.84);
}

.video-preview-duration {
  position: absolute;
  right: 16rpx;
  bottom: 14rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: calc(22rpx * var(--font-scale));
}

.video-player {
  width: 100%;
  height: 100%;
  display: block;
}

.video-info {
  margin-top: 10rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-sub);
}

.delete-video {
  color: var(--mint-danger);
}

.bottom-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(34rpx + env(safe-area-inset-bottom));
  z-index: 60;
}

.save-btn {
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 999rpx;
  border: none;
  color: #ffffff;
  font-size: calc(32rpx * var(--font-scale));
  font-weight: 600;
  background: linear-gradient(120deg, var(--mint-primary) 0%, var(--mint-primary-2) 100%);
  box-shadow: 0 14rpx 28rpx rgba(47, 161, 132, 0.3);
}

.save-btn::after {
  border: none;
}

.save-btn[disabled] {
  opacity: 0.55;
}
</style>
