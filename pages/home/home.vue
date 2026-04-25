<template>
  <view class="home-page" :style="pageStyleVars">
    <view class="date-bar">
      <text class="arrow" @click="goPrevDay">‹</text>
      <picker mode="date" :value="currentDate" @change="onDatePick" class="date-picker">
        <view class="date-center">
          <text class="date-text">{{ displayDateText }}</text>
        </view>
      </picker>
      <text class="arrow" @click="goNextDay">›</text>
    </view>

    <view class="stats-card">
      <view class="stats-inner">
        <view
          v-if="taskStats.total > 0"
          class="progress-ring"
          :style="{ '--progress-deg': `${taskStats.rate * 3.6}deg` }"
        >
          <view class="progress-core">{{ taskStats.rate }}%</view>
        </view>
        <text class="stats-text">
          今日共 {{ taskStats.total }} 个任务，已完成 {{ taskStats.completed }} 个。
          {{ taskStats.message }} {{ taskStats.emoji }}{{ taskStats.stars ? ` ${taskStats.stars}` : '' }}
        </text>
      </view>
    </view>

    <view class="date-tools">
      <text v-if="dailyTasks.length > 1" class="sort-tip">长按 ≡ 拖拽排序</text>
      <text v-if="!isCurrentDateToday" class="today-btn" @click="backToToday">回到今日</text>
    </view>

    <scroll-view class="task-list" scroll-y>
      <view v-if="dailyTasks.length === 0" class="empty-wrap">
        <text class="empty-text">暂无任务，请从任务池添加</text>
      </view>

      <view v-else>
        <view
          v-for="(task, index) in dailyTasks"
          :key="task.id"
          class="task-card"
          :class="{
            dragging: dragState.active && dragState.taskId === task.id,
            danger: deleteArmedTaskId === String(task.id)
          }"
          @click="goDetail(task)"
          @longpress="armTaskDelete(task)"
        >
          <text
            v-if="deleteArmedTaskId === String(task.id)"
            class="task-delete-x"
            @click.stop="confirmDeleteTaskFromCard(task)"
          >
            ×
          </text>
          <view class="task-head">
            <view class="task-name-wrap">
              <text class="task-edit-icon" @click.stop="editTaskTitle(task)">✎</text>
              <text class="task-name">{{ task.name }}</text>
            </view>
            <view class="status-wrap">
              <text
                class="drag-handle"
                @longpress.stop="startDrag(index, $event)"
                @touchmove.stop.prevent="onDragMove($event)"
                @touchend.stop="endDrag"
                @touchcancel.stop="endDrag"
              >
                ≡
              </text>
              <view
                class="status-tag clickable"
                :class="statusClass(task.status)"
                hover-class="status-tag-active"
                :hover-stay-time="90"
                @click.stop="toggleTaskStatus(task)"
              >
                <text class="status-icon">{{ statusIcon(task.status) }}</text>
                <text class="status-label">{{ statusLabel(task.status) }}</text>
              </view>
            </view>
          </view>

          <view class="preview-row">
            <text class="preview-text">{{ getPreviewText(task) }}</text>
            <image v-if="getFirstImage(task)" class="preview-image" :src="getFirstImage(task)" mode="aspectFill" />
            <view v-else-if="getVideoPath(task)" class="video-thumb">
              <text class="video-text">视频</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <button class="bottom-btn secondary" :disabled="!isCurrentDateToday" @click="syncToTomorrow">
        同步任务到明天
      </button>
      <button class="bottom-btn primary" @click="openManageMenu">管理任务</button>
    </view>

    <view v-if="editPanelVisible" class="mask" @click="editPanelVisible = false">
      <view class="sheet" @click.stop>
        <text class="sheet-title">编辑当天任务列表</text>

        <scroll-view class="sheet-list" scroll-y>
          <view v-if="dailyTasks.length === 0" class="sheet-empty">当天暂无任务</view>
          <view v-for="item in dailyTasks" :key="item.id" class="sheet-item">
            <text class="sheet-name">{{ item.name }}</text>
            <text class="delete-btn" @click="deleteTodayTask(item)">删除</text>
          </view>
        </scroll-view>

        <button class="sheet-add" @click="openPoolPicker">从任务池添加任务</button>
        <button class="sheet-close" @click="editPanelVisible = false">关闭</button>
      </view>
    </view>

    <view v-if="poolPickerVisible" class="mask" @click="poolPickerVisible = false">
      <view class="sheet" @click.stop>
        <text class="sheet-title">从任务池添加任务</text>

        <scroll-view class="sheet-list" scroll-y>
          <view v-if="availablePoolTasks.length === 0" class="sheet-empty">任务池中暂无可添加任务</view>
          <checkbox-group @change="onPoolSelectChange">
            <label v-for="poolTask in availablePoolTasks" :key="poolTask.id" class="sheet-item selectable">
              <text class="sheet-name">{{ poolTask.name }}</text>
              <checkbox
                :value="String(poolTask.id)"
                :checked="poolSelectedIds.includes(String(poolTask.id))"
                color="#2fa184"
              />
            </label>
          </checkbox-group>
        </scroll-view>

        <button class="sheet-add" :disabled="poolSelectedIds.length === 0" @click="addSelectedFromPool">
          添加选中（{{ poolSelectedIds.length }}）
        </button>
        <button class="sheet-close" @click="poolPickerVisible = false">关闭</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getDailyRecord, setDailyRecord, getTaskPool, setItem } from '@/utils/storage.js'
import { formatDate, getToday, getNextDay, getPrevDay, getWeekday } from '@/utils/dateHelper.js'
import { getThemeVars, getFontConfig, applyNavigationBarTheme, applyTabBarTheme } from '@/utils/theme.js'

const STATUS_FLOW = ['not_started', 'in_progress', 'completed']
const EDITING_TASK_SNAPSHOT_KEY = 'editingTaskSnapshot'

export default {
  data() {
    return {
      currentDate: getToday(),
      dailyTasks: [],
      activeThemeVars: getThemeVars('mint'),
      activeFontConfig: getFontConfig('normal'),
      editPanelVisible: false,
      poolPickerVisible: false,
      availablePoolTasks: [],
      poolSelectedIds: [],
      deleteArmedTaskId: '',
      dragState: {
        active: false,
        index: -1,
        startY: 0,
        itemHeight: 120,
        taskId: '',
        startedAt: 0,
        lastEndAt: 0
      }
    }
  },
  computed: {
    displayDateText() {
      const dateText = formatDate(this.currentDate, 'YYYY年MM月DD日')
      const weekday = getWeekday(this.currentDate).replace('周', '星期')
      return `${dateText} ${weekday}`
    },
    isCurrentDateToday() {
      return this.currentDate === getToday()
    },
    pageStyleVars() {
      return {
        ...this.activeThemeVars,
        '--page-font-size': this.activeFontConfig.varSize,
        '--font-scale': String(this.activeFontConfig.scale)
      }
    },
    taskStats() {
      const total = this.dailyTasks.length
      const completed = this.dailyTasks.filter((item) => item && item.status === 'completed').length
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0

      if (total === 0) {
        return {
          total: 0,
          completed: 0,
          rate: 0,
          message: '轻松开个头吧',
          emoji: '🌱',
          stars: ''
        }
      }

      if (rate >= 90) {
        return {
          total,
          completed,
          rate,
          message: '你太棒啦',
          emoji: '🏆',
          stars: '★★★★★'
        }
      }

      if (rate >= 70) {
        return {
          total,
          completed,
          rate,
          message: '真不错哦',
          emoji: '😄',
          stars: '★★★★'
        }
      }

      return {
        total,
        completed,
        rate,
        message: '继续加油哦',
        emoji: '💪',
        stars: '★★★'
      }
    }
  },
  onShow() {
    this.resetDragState()
    this.loadAppAppearance()
    this.loadDailyTasks(this.currentDate)
  },
  methods: {
    showToast(title, icon = 'none') {
      uni.showToast({ title, icon, duration: 1800 })
    },
    resetDragState() {
      this.dragState = {
        active: false,
        index: -1,
        startY: 0,
        itemHeight: 120,
        taskId: '',
        startedAt: 0,
        lastEndAt: Date.now()
      }
    },
    loadAppAppearance() {
      const app = getApp()
      const globalData = (app && app.globalData) || {}
      const activeTheme = globalData.activeTheme || 'mint'
      this.activeThemeVars = globalData.themeVars || getThemeVars(activeTheme)
      this.activeFontConfig = globalData.fontConfig || getFontConfig((globalData.appSettings && globalData.appSettings.fontSize) || 'normal')
      applyNavigationBarTheme(activeTheme)
      applyTabBarTheme(activeTheme)
    },
    statusLabel(status) {
      if (status === 'in_progress') return '进行中'
      if (status === 'completed') return '已完成'
      return '未开始'
    },
    statusClass(status) {
      if (status === 'in_progress') return 'progress'
      if (status === 'completed') return 'done'
      return 'default'
    },
    statusIcon(status) {
      if (status === 'in_progress') return '◔'
      if (status === 'completed') return '✓'
      return '○'
    },
    normalizeTask(raw, index = 0) {
      const source = raw && typeof raw === 'object' ? raw : {}
      const checkin = source.checkin && typeof source.checkin === 'object' ? source.checkin : {}
      let images = []
      if (Array.isArray(raw && raw.images)) {
        images = raw.images
      } else if (Array.isArray(raw && raw.checkinImages)) {
        images = raw.checkinImages
      } else if (Array.isArray(raw && raw.mediaImages)) {
        images = raw.mediaImages
      } else if (Array.isArray(source.media && source.media.images)) {
        images = source.media.images
      } else if (Array.isArray(checkin.images)) {
        images = checkin.images
      }
      const checkinText =
        (raw && (raw.checkinText || raw.text || raw.content || raw.checkinContent || raw.checkin_content || raw.note || raw.remark)) ||
        checkin.text ||
        checkin.content ||
        ''
      const videoPath =
        (raw && (raw.video || raw.videoPath || raw.mediaVideoPath || raw.mediaVideo || raw.recordVideoPath)) ||
        (source.media && source.media.video) ||
        checkin.video ||
        ''
      const audioPath =
        (raw && (raw.audioPath || raw.audio || raw.recordPath || raw.voicePath || raw.voice)) ||
        (source.media && source.media.audio) ||
        checkin.audio ||
        ''
      return {
        ...source,
        id: raw && raw.id ? raw.id : `daily_${Date.now()}_${index}`,
        name: raw && raw.name ? raw.name : '未命名任务',
        sortOrder: Number(raw && raw.sortOrder ? raw.sortOrder : index + 1),
        status: raw && raw.status ? raw.status : 'not_started',
        checkinText,
        text: checkinText,
        content: checkinText,
        images,
        checkinImages: images,
        video: videoPath,
        videoPath,
        videoDuration: Number((raw && raw.videoDuration) || (raw && raw.video_duration) || checkin.videoDuration || 0),
        audioPath,
        audioDuration: Number((raw && raw.audioDuration) || (raw && raw.audio_duration) || checkin.audioDuration || 0),
        checkin: {
          ...checkin,
          text: checkinText,
          content: checkinText,
          images,
          video: videoPath,
          audio: audioPath,
          videoDuration: Number((raw && raw.videoDuration) || (raw && raw.video_duration) || checkin.videoDuration || 0),
          audioDuration: Number((raw && raw.audioDuration) || (raw && raw.audio_duration) || checkin.audioDuration || 0)
        }
      }
    },
    sanitizeForDailyFromPool(task, index) {
      return {
        id: task.id || `task_${Date.now()}_${index}`,
        name: task.name || '未命名任务',
        sortOrder: index + 1,
        status: 'not_started',
        checkinText: '',
        images: [],
        video: ''
      }
    },
    sanitizeForTomorrow(task, index) {
      return {
        id: task.id,
        name: task.name,
        sortOrder: index + 1,
        status: 'not_started',
        checkinText: '',
        images: [],
        video: ''
      }
    },
    saveCurrentDateTasks() {
      const normalized = this.dailyTasks.map((item, index) => ({
        ...this.normalizeTask(item, index),
        sortOrder: index + 1
      }))
      this.dailyTasks = normalized
      setDailyRecord(this.currentDate, normalized)
    },
    loadDailyTasks(dateStr) {
      const existing = getDailyRecord(dateStr)
      if (Array.isArray(existing) && existing.length > 0) {
        this.dailyTasks = existing
          .map((item, index) => this.normalizeTask(item, index))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        return
      }

      this.dailyTasks = []
    },
    goPrevDay() {
      this.currentDate = getPrevDay(this.currentDate)
      this.loadDailyTasks(this.currentDate)
    },
    goNextDay() {
      this.currentDate = getNextDay(this.currentDate)
      this.loadDailyTasks(this.currentDate)
    },
    onDatePick(e) {
      const value = e && e.detail && e.detail.value ? e.detail.value : ''
      if (!value) return
      this.currentDate = value
      this.loadDailyTasks(this.currentDate)
    },
    backToToday() {
      this.currentDate = getToday()
      this.loadDailyTasks(this.currentDate)
    },
    toggleTaskStatus(task) {
      this.deleteArmedTaskId = ''
      if (this.dragState.active) return
      const idx = this.dailyTasks.findIndex((item) => item.id === task.id)
      if (idx < 0) return
      const current = this.dailyTasks[idx].status || 'not_started'
      const currentIndex = STATUS_FLOW.indexOf(current)
      const nextStatus = STATUS_FLOW[(currentIndex + 1 + STATUS_FLOW.length) % STATUS_FLOW.length]
      this.dailyTasks[idx] = { ...this.dailyTasks[idx], status: nextStatus }
      this.saveCurrentDateTasks()
    },
    getPreviewText(task) {
      const text = String(task.checkinText || '').trim()
      if (!text) return '暂无打卡内容'
      if (text.length <= 20) return text
      return `${text.slice(0, 20)}...`
    },
    getFirstImage(task) {
      return Array.isArray(task.images) && task.images.length > 0 ? task.images[0] : ''
    },
    getVideoPath(task) {
      return task.video || ''
    },
    goDetail(task) {
      if (this.deleteArmedTaskId) {
        this.deleteArmedTaskId = ''
        return
      }
      const now = Date.now()
      if (this.dragState.active) {
        const dragElapsed = now - Number(this.dragState.startedAt || 0)
        // 兜底：异常残留的拖拽状态超过 1.5s 后自动清理，避免卡住点击。
        if (dragElapsed > 1500) {
          this.resetDragState()
        } else {
          return
        }
      }
      if (now - Number(this.dragState.lastEndAt || 0) < 220) return
      setItem(EDITING_TASK_SNAPSHOT_KEY, {
        date: this.currentDate,
        taskId: task && task.id ? String(task.id) : '',
        task: task || null,
        savedAt: Date.now()
      })
      uni.navigateTo({
        url: `/pages/checkin-detail/checkin-detail?date=${this.currentDate}&taskId=${task.id}`
      })
    },
    syncToTomorrow() {
      if (!this.isCurrentDateToday) {
        this.showToast('仅支持在今天同步任务到明天')
        return
      }
      if (this.dailyTasks.length === 0) {
        this.showToast('今天暂无任务可同步')
        return
      }

      const tomorrow = getNextDay(this.currentDate)
      const nextTasks = this.dailyTasks.map((item, index) => this.sanitizeForTomorrow(item, index))
      setDailyRecord(tomorrow, nextTasks)
      this.showToast('已同步到明天', 'success')
    },
    openManageMenu() {
      this.deleteArmedTaskId = ''
      uni.showActionSheet({
        itemList: ['从任务池添加任务', '编辑当天任务列表'],
        success: (res) => {
          if (res.tapIndex === 0) this.openPoolPicker()
          if (res.tapIndex === 1) this.editPanelVisible = true
        }
      })
    },
    getAvailablePoolTasks() {
      const pool = getTaskPool().slice().sort((a, b) => {
        const sa = Number(a && a.sortOrder ? a.sortOrder : 0)
        const sb = Number(b && b.sortOrder ? b.sortOrder : 0)
        return sa - sb
      })
      const existingIds = new Set(this.dailyTasks.map((item) => String(item.id)))
      return pool.filter((item) => !existingIds.has(String(item.id)))
    },
    openPoolPicker() {
      this.availablePoolTasks = this.getAvailablePoolTasks()
      if (this.availablePoolTasks.length === 0) {
        this.showToast('没有可添加的任务')
        return
      }
      this.editPanelVisible = false
      this.poolSelectedIds = []
      this.poolPickerVisible = true
    },
    onPoolSelectChange(e) {
      this.poolSelectedIds = (e && e.detail && e.detail.value) || []
    },
    addSelectedFromPool() {
      this.deleteArmedTaskId = ''
      if (this.poolSelectedIds.length === 0) {
        this.showToast('请先选择任务')
        return
      }
      const selectedSet = new Set(this.poolSelectedIds.map((id) => String(id)))
      const toAdd = this.availablePoolTasks.filter((task) => selectedSet.has(String(task.id)))
      if (toAdd.length === 0) {
        this.showToast('没有可添加任务')
        return
      }

      const appended = toAdd.map((task, index) => this.sanitizeForDailyFromPool(task, this.dailyTasks.length + index))
      this.dailyTasks = [...this.dailyTasks, ...appended].map((item, index) => ({
        ...item,
        sortOrder: index + 1
      }))
      this.saveCurrentDateTasks()
      this.showToast(`已添加${toAdd.length}个任务`, 'success')
      this.availablePoolTasks = this.getAvailablePoolTasks()
      this.poolSelectedIds = []
      if (this.availablePoolTasks.length === 0) {
        this.poolPickerVisible = false
      }
    },
    deleteTodayTask(task) {
      this.deleteArmedTaskId = ''
      uni.showModal({
        title: '删除当天任务',
        content: `确定删除「${task.name}」吗？`,
        confirmText: '删除',
        success: (res) => {
          if (!res.confirm) return
          this.dailyTasks = this.dailyTasks
            .filter((item) => item.id !== task.id)
            .map((item, index) => ({ ...item, sortOrder: index + 1 }))
          this.saveCurrentDateTasks()
          this.showToast('已删除', 'success')
        }
      })
    },
    getPointY(event) {
      if (event && event.touches && event.touches[0]) {
        return Number(event.touches[0].pageY || event.touches[0].clientY || 0)
      }
      if (event && event.changedTouches && event.changedTouches[0]) {
        return Number(event.changedTouches[0].pageY || event.changedTouches[0].clientY || 0)
      }
      if (event && event.detail) {
        return Number(event.detail.y || 0)
      }
      return 0
    },
    measureTaskCardHeight(callback) {
      const query = uni.createSelectorQuery().in(this)
      query.select('.task-card').boundingClientRect()
      query.exec((res) => {
        const rect = res && res[0]
        callback(rect && rect.height ? rect.height : 120)
      })
    },
    moveTask(list, fromIndex, toIndex) {
      const next = list.slice()
      const item = next.splice(fromIndex, 1)[0]
      next.splice(toIndex, 0, item)
      return next
    },
    startDrag(index, event) {
      this.deleteArmedTaskId = ''
      if (this.dailyTasks.length <= 1) return
      this.measureTaskCardHeight((height) => {
        this.dragState = {
          active: true,
          index,
          startY: this.getPointY(event),
          itemHeight: height || 120,
          taskId: this.dailyTasks[index] ? this.dailyTasks[index].id : '',
          startedAt: Date.now(),
          lastEndAt: Number(this.dragState.lastEndAt || 0)
        }
      })
    },
    onDragMove(event) {
      if (!this.dragState.active) return
      const currentY = this.getPointY(event)
      const deltaY = currentY - this.dragState.startY
      const threshold = this.dragState.itemHeight * 0.45
      if (Math.abs(deltaY) < threshold) return

      const direction = deltaY > 0 ? 1 : -1
      const nextIndex = Math.max(0, Math.min(this.dailyTasks.length - 1, this.dragState.index + direction))
      if (nextIndex === this.dragState.index) return

      this.dailyTasks = this.moveTask(this.dailyTasks, this.dragState.index, nextIndex)
      this.dragState = {
        ...this.dragState,
        index: nextIndex,
        startY: currentY
      }
    },
    endDrag() {
      if (!this.dragState.active) return
      this.saveCurrentDateTasks()
      this.resetDragState()
    },
    armTaskDelete(task) {
      if (!task || task.id === undefined || task.id === null) return
      if (this.dragState.active) return
      this.deleteArmedTaskId = String(task.id)
    },
    confirmDeleteTaskFromCard(task) {
      if (!task) return
      uni.showModal({
        title: '删除当天任务',
        content: `确定删除「${task.name || '该任务'}」吗？`,
        confirmText: '删除',
        success: (res) => {
          if (!res.confirm) return
          this.dailyTasks = this.dailyTasks
            .filter((item) => String(item.id) !== String(task.id))
            .map((item, index) => ({ ...item, sortOrder: index + 1 }))
          this.deleteArmedTaskId = ''
          this.saveCurrentDateTasks()
          this.showToast('已删除', 'success')
        }
      })
    },
    editTaskTitle(task) {
      if (!task) return
      uni.showModal({
        title: '修改任务标题',
        editable: true,
        placeholderText: '请输入任务标题（最多20字）',
        content: String(task.name || ''),
        confirmText: '保存',
        success: (res) => {
          if (!res.confirm) return
          const nextName = String((res && res.content) || '').trim()
          if (!nextName) {
            this.showToast('标题不能为空')
            return
          }
          if (nextName.length > 20) {
            this.showToast('标题最多20字')
            return
          }
          const idx = this.dailyTasks.findIndex((item) => String(item.id) === String(task.id))
          if (idx < 0) return
          this.dailyTasks[idx] = {
            ...this.dailyTasks[idx],
            name: nextName
          }
          this.deleteArmedTaskId = ''
          this.saveCurrentDateTasks()
          this.showToast('已更新标题', 'success')
        }
      })
    }
  }
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 180rpx;
  box-sizing: border-box;
  background: var(--bg-color);
  font-size: var(--page-font-size);

  --mint-card: var(--card-bg-color);
  --mint-title: var(--text-color);
  --mint-sub: var(--text-secondary-color);
  --mint-border: #cdeee2;
  --mint-shadow: 0 10rpx 26rpx rgba(43, 132, 112, 0.12);
  --mint-primary: var(--primary-color);
  --mint-primary-2: var(--primary-color);
}

.date-bar {
  height: 96rpx;
  border-radius: 24rpx;
  background: var(--mint-card);
  border: 2rpx solid var(--mint-border);
  box-shadow: var(--mint-shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx;
  margin-bottom: 20rpx;
}

.arrow {
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 14rpx;
  background: #effaf6;
  color: var(--mint-primary-2);
  font-size: 40rpx;
}

.date-picker,
.date-center {
  flex: 1;
}

.date-center {
  text-align: center;
}

.date-text {
  font-size: calc(30rpx * var(--font-scale));
  font-weight: 600;
  color: var(--mint-title);
}

.date-tools {
  min-height: 56rpx;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 8rpx;
}

.today-btn,
.sort-tip {
  font-size: calc(24rpx * var(--font-scale));
}

.today-btn {
  margin-left: auto;
  padding: 0 18rpx;
  height: 50rpx;
  line-height: 50rpx;
  border-radius: 12rpx;
  color: var(--mint-primary-2);
  background: #e9f9f3;
}

.sort-tip {
  color: var(--mint-sub);
}

.stats-card {
  margin-bottom: 14rpx;
  background: var(--mint-card);
  border: 2rpx solid var(--mint-border);
  border-radius: 18rpx;
  box-shadow: var(--mint-shadow);
  padding: 14rpx 18rpx;
}

.stats-inner {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.progress-ring {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: conic-gradient(
    var(--mint-primary) 0deg var(--progress-deg),
    #dfeee8 var(--progress-deg) 360deg
  );
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.progress-core {
  width: 66rpx;
  height: 66rpx;
  border-radius: 50%;
  background: var(--mint-card);
  color: var(--mint-title);
  font-size: calc(20rpx * var(--font-scale));
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stats-text {
  display: block;
  flex: 1;
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-sub);
  line-height: 1.5;
}

.task-list {
  max-height: calc(100vh - 430rpx);
}

.empty-wrap {
  padding-top: 140rpx;
  text-align: center;
}

.empty-text {
  font-size: calc(30rpx * var(--font-scale));
  color: var(--mint-sub);
}

.task-card {
  position: relative;
  background: var(--mint-card);
  border: 2rpx solid var(--mint-border);
  border-radius: 24rpx;
  box-shadow: var(--mint-shadow);
  padding: 24rpx;
  margin-bottom: 18rpx;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.task-card.dragging {
  transform: scale(0.985);
  opacity: 0.84;
  box-shadow: 0 18rpx 34rpx rgba(43, 132, 112, 0.22);
}

.task-card.danger {
  border-color: #f0c8cb;
}

.task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.task-delete-x {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  border-radius: 999rpx;
  background: #ffffff;
  border: 2rpx solid #f3d5d8;
  color: #db6d76;
  font-size: calc(30rpx * var(--font-scale));
  z-index: 2;
}

.task-name-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.task-edit-icon {
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  border-radius: 10rpx;
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-primary-2);
  background: #edf8f4;
  flex-shrink: 0;
}

.task-name {
  flex: 1;
  min-width: 0;
  font-size: calc(32rpx * var(--font-scale));
  color: var(--mint-title);
  font-weight: 600;
  word-break: break-all;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.drag-handle {
  width: 64rpx;
  height: 64rpx;
  line-height: 60rpx;
  text-align: center;
  border-radius: 14rpx;
  background: #edf8f4;
  color: var(--mint-primary-2);
  font-size: 34rpx;
}

.status-tag {
  font-size: calc(22rpx * var(--font-scale));
  border-radius: 999rpx;
  padding: 10rpx 16rpx;
  border: 2rpx solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.status-tag.clickable {
  min-width: 158rpx;
  min-height: 56rpx;
  text-align: center;
}

.status-tag.default {
  background: #f3f7f6;
  color: #6f8d84;
  border-color: #dbe7e3;
}

.status-tag.progress {
  background: #fff5df;
  color: #b8801d;
  border-color: #f6deab;
}

.status-tag.done {
  background: #e8f8ed;
  color: #2f8f4c;
  border-color: #bfe5c9;
}

.status-icon {
  font-size: calc(22rpx * var(--font-scale));
  font-weight: 700;
  line-height: 1;
}

.status-label {
  font-size: calc(22rpx * var(--font-scale));
  font-weight: 600;
}

.status-tag-active {
  transform: translateY(1rpx) scale(0.97);
  opacity: 0.9;
}

.preview-row {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.preview-text {
  flex: 1;
  min-width: 0;
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-sub);
}

.preview-image,
.video-thumb {
  width: 84rpx;
  height: 84rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.video-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9f7f2;
  border: 2rpx solid var(--mint-border);
}

.video-text {
  font-size: calc(24rpx * var(--font-scale));
  color: var(--mint-primary-2);
}

.bottom-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 38rpx;
  display: flex;
  gap: 16rpx;
}

.bottom-btn {
  flex: 1;
  height: 90rpx;
  line-height: 90rpx;
  border-radius: 999rpx;
  font-size: calc(30rpx * var(--font-scale));
  margin: 0;
}

.bottom-btn::after {
  border: none;
}

.bottom-btn.secondary {
  background: #e8faf4;
  color: var(--mint-primary-2);
  border: 2rpx solid var(--mint-border);
}

.bottom-btn.secondary[disabled] {
  opacity: 0.5;
}

.bottom-btn.primary {
  background: linear-gradient(120deg, var(--mint-primary) 0%, var(--mint-primary-2) 100%);
  color: #ffffff;
  box-shadow: 0 14rpx 28rpx rgba(47, 161, 132, 0.3);
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 99;
}

.sheet {
  width: 100%;
  max-height: 75vh;
  background: var(--mint-card);
  border-top-left-radius: 26rpx;
  border-top-right-radius: 26rpx;
  padding: 26rpx;
  box-sizing: border-box;
}

.sheet-title {
  display: block;
  font-size: calc(30rpx * var(--font-scale));
  color: var(--mint-title);
  font-weight: 600;
  margin-bottom: 20rpx;
}

.sheet-list {
  max-height: 50vh;
}

.sheet-empty {
  text-align: center;
  color: var(--mint-sub);
  padding: 48rpx 0;
  font-size: calc(26rpx * var(--font-scale));
}

.sheet-item {
  min-height: 84rpx;
  border-radius: 16rpx;
  border: 2rpx solid var(--mint-border);
  padding: 18rpx 20rpx;
  margin-bottom: 14rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.sheet-item.selectable {
  min-height: 92rpx;
}

.sheet-name {
  font-size: calc(28rpx * var(--font-scale));
  color: var(--mint-title);
}

.delete-btn {
  font-size: calc(26rpx * var(--font-scale));
  color: #e86a70;
}

.sheet-add,
.sheet-close {
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 16rpx;
  font-size: calc(28rpx * var(--font-scale));
  margin-top: 10rpx;
}

.sheet-add {
  color: #ffffff;
  background: var(--mint-primary);
}

.sheet-close {
  color: var(--mint-sub);
  background: #eef5f3;
}

.sheet-add::after,
.sheet-close::after {
  border: none;
}

@media (prefers-color-scheme: dark) {
  .home-page {
    --mint-border: #2b5950;
    --mint-shadow: 0 10rpx 26rpx rgba(0, 0, 0, 0.35);
  }

  .arrow,
  .today-btn,
  .drag-handle {
    background: #1e443b;
  }

  .status-tag.default {
    background: #21453d;
    color: #9ec3b8;
  }

  .status-tag.progress {
    background: #4a3a22;
    color: #efc77a;
  }

  .status-tag.done {
    background: #224433;
    color: #78d39a;
  }

  .video-thumb,
  .bottom-btn.secondary,
  .sheet-close {
    background: #1e443b;
  }
}
</style>
