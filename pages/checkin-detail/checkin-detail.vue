<template>
  <view class="detail-page">
    <scroll-view class="content" scroll-y>
      <view class="header-card">
        <text class="task-name">{{ taskName }}</text>
        <text class="date-text">{{ displayDate }}</text>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">打卡文字</text>
          <text class="section-tip">剩余 {{ remainingChars }} 字</text>
        </view>
        <textarea
          v-model="checkinText"
          class="text-input"
          maxlength="200"
          placeholder="记录一下今天的完成情况..."
        />
      </view>

      <view class="section-card">
        <text class="section-title">媒体上传（二选一）</text>

        <view class="upload-actions">
          <button class="upload-btn" :disabled="videoExists" @click="chooseImageFlow">
            上传图片 ({{ images.length }}/3)
          </button>
          <button class="upload-btn" :disabled="imageExists" @click="chooseVideoFlow">
            上传视频
          </button>
        </view>

        <text v-if="videoExists" class="hint">当前已有视频，如需上传图片请先删除视频</text>
        <text v-if="videoExists" class="switch-link" @click="switchToImageUpload">改为上传图片</text>
        <text v-if="imageExists" class="hint">当前已有图片，如需上传视频请先删除图片</text>
        <text v-if="imageExists" class="switch-link" @click="switchToVideoUpload">改为上传视频</text>

        <view v-if="images.length > 0" class="media-list">
          <view v-for="(img, index) in images" :key="img" class="image-item">
            <image :src="img" class="thumb" mode="aspectFill" />
            <text class="delete-icon" @click="removeImage(index)">✕</text>
            <view class="sort-controls">
              <text class="sort-btn" :class="{ disabled: index === 0 }" @click="moveImage(index, -1)">←</text>
              <text
                class="sort-btn"
                :class="{ disabled: index === images.length - 1 }"
                @click="moveImage(index, 1)"
              >
                →
              </text>
            </view>
          </view>
        </view>

        <view v-if="video.path" class="video-wrap">
          <video :src="video.path" class="video-player" :controls="false" objectFit="cover"></video>
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
import { getDailyRecord, setDailyRecord } from '@/utils/storage.js'
import { formatDate, getWeekday } from '@/utils/dateHelper.js'
import {
  compressAndSaveImage,
  validateAndSaveVideo,
  deleteMediaFile
} from '@/utils/mediaHelper.js'

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
      mediaType: '',
      saving: false
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
    remainingChars() {
      return Math.max(0, 200 - String(this.checkinText || '').length)
    },
    imageExists() {
      return this.images.length > 0
    },
    videoExists() {
      return !!this.video.path
    }
  },
  onLoad(options) {
    this.date = options.date || ''
    this.taskId = options.taskId || ''
    this.loadTaskDetail()
  },
  methods: {
    showToast(title, icon = 'none') {
      uni.showToast({ title, icon, duration: 1800 })
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
      const task = dailyList.find((item) => String(item.id) === String(this.taskId))
      if (!task) {
        this.showToast('任务不存在')
        setTimeout(() => {
          uni.navigateBack()
        }, 300)
        return
      }

      this.taskName = task.name || '任务详情'
      this.checkinText = task.checkinText || ''
      this.images = Array.isArray(task.images)
        ? task.images.slice(0, 3)
        : Array.isArray(task.checkinImages)
          ? task.checkinImages.slice(0, 3)
          : []
      this.video = {
        path: task.video || task.videoPath || '',
        duration: Number(task.videoDuration || 0)
      }
      this.mediaType = task.mediaType || (this.images.length ? 'image' : this.video.path ? 'video' : '')
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
          success: (res) => {
            resolve(!!res.confirm)
          },
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
      uni.chooseVideo({
        sourceType: ['album', 'camera'],
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

            const savedPath = await validateAndSaveVideo(
              {
                tempFilePath: res.tempFilePath,
                duration: res.duration,
                size: res.size
              },
              300,
              500
            )
            this.video = {
              path: savedPath,
              duration: Number(res.duration || 0)
            }
            this.mediaType = 'video'
            this.showToast('视频已添加', 'success')
          } catch (error) {
            this.showToast('视频处理失败')
          } finally {
            uni.hideLoading()
          }
        }
      })
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
    formatDuration(duration) {
      const total = Number(duration || 0)
      const m = Math.floor(total / 60)
      const s = Math.floor(total % 60)
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    },
    async handleSave() {
      const text = String(this.checkinText || '').trim()
      const hasImage = this.images.length > 0
      const hasVideo = !!this.video.path

      if (!text && !hasImage && !hasVideo) {
        this.showToast('请填写文字或上传媒体')
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
          images: this.images.slice(),
          video: this.video.path,
          videoDuration: this.video.duration,
          mediaType: hasImage ? 'image' : hasVideo ? 'video' : ''
        }

        setDailyRecord(this.date, dailyList)
        this.showToast('保存成功', 'success')
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
  background: var(--mint-bg);
  padding: 24rpx 24rpx 170rpx;
  box-sizing: border-box;

  --mint-bg: #eefcf8;
  --mint-card: #ffffff;
  --mint-title: #16342f;
  --mint-sub: #6c9489;
  --mint-border: #cdeee2;
  --mint-shadow: 0 10rpx 26rpx rgba(43, 132, 112, 0.12);
  --mint-primary: #43c5a1;
  --mint-primary-2: #2fa184;
  --mint-danger: #e86a70;
}

.content {
  max-height: calc(100vh - 210rpx);
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
  font-size: 36rpx;
  font-weight: 700;
  color: var(--mint-title);
}

.date-text {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--mint-sub);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 30rpx;
  color: var(--mint-title);
  font-weight: 600;
}

.section-tip,
.hint {
  font-size: 24rpx;
  color: var(--mint-sub);
}

.switch-link {
  display: inline-block;
  margin-top: 8rpx;
  font-size: 24rpx;
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
  font-size: 28rpx;
  color: var(--mint-title);
  background: #f8fffc;
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
  font-size: 26rpx;
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
}

.video-player {
  width: 100%;
  height: 360rpx;
  border-radius: 16rpx;
  border: 2rpx solid var(--mint-border);
}

.video-info {
  margin-top: 10rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 24rpx;
  color: var(--mint-sub);
}

.delete-video {
  color: var(--mint-danger);
}

.bottom-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 34rpx;
}

.save-btn {
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 999rpx;
  border: none;
  color: #ffffff;
  font-size: 32rpx;
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

@media (prefers-color-scheme: dark) {
  .detail-page {
    --mint-bg: #10241f;
    --mint-card: #173730;
    --mint-title: #def5ee;
    --mint-sub: #92b9af;
    --mint-border: #2b5950;
    --mint-shadow: 0 10rpx 26rpx rgba(0, 0, 0, 0.36);
    --mint-primary: #54d2ae;
    --mint-primary-2: #3ca98d;
  }

  .text-input,
  .upload-btn,
  .sort-btn {
    background: #1d433a;
  }
}
</style>
