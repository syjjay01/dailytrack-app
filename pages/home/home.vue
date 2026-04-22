<template>
  <view class="home-page">
    <view class="date-bar">
      <text class="arrow" @click="goPrevDay">‹</text>
      <picker mode="date" :value="currentDate" @change="onDatePick" class="date-picker">
        <view class="date-center">
          <text class="date-text">{{ displayDateText }}</text>
        </view>
      </picker>
      <text v-if="!isCurrentDateToday" class="today-btn" @click="backToToday">今日</text>
      <text class="arrow" @click="goNextDay">›</text>
    </view>

    <scroll-view class="task-list" scroll-y>
      <view v-if="dailyTasks.length === 0" class="empty-wrap">
        <text class="empty-text">暂无任务，请从任务池添加</text>
      </view>

      <view v-else>
        <view
          v-for="task in dailyTasks"
          :key="task.id"
          class="task-card"
          @click="goDetail(task)"
        >
          <view class="task-head">
            <text class="task-name">{{ task.name }}</text>
            <view class="status-wrap">
              <text class="status-tag" :class="statusClass(task.status)">{{ statusLabel(task.status) }}</text>
              <text class="status-btn" @click.stop="toggleTaskStatus(task)">•••</text>
            </view>
          </view>

          <view class="preview-row">
            <text class="preview-text">{{ getPreviewText(task) }}</text>
            <image
              v-if="getFirstImage(task)"
              class="preview-image"
              :src="getFirstImage(task)"
              mode="aspectFill"
            />
            <view v-else-if="getVideoPath(task)" class="video-thumb">
              <text class="video-text">视频</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <button
        class="bottom-btn secondary"
        :disabled="!isCurrentDateToday"
        @click="syncToTomorrow"
      >
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
            <label
              v-for="poolTask in availablePoolTasks"
              :key="poolTask.id"
              class="sheet-item selectable"
            >
              <text class="sheet-name">{{ poolTask.name }}</text>
              <checkbox :value="String(poolTask.id)" :checked="poolSelectedIds.includes(String(poolTask.id))" color="#2fa184" />
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
import { getTaskPool, getDailyRecord, setDailyRecord, getItem } from '@/utils/storage.js'
import { formatDate, getToday, getNextDay, getPrevDay, getWeekday } from '@/utils/dateHelper.js'

const DAILY_KEY_PREFIX = 'dailyRecord_'
const STATUS_FLOW = ['not_started', 'in_progress', 'completed']

export default {
  data() {
    return {
      currentDate: getToday(),
      dailyTasks: [],
      editPanelVisible: false,
      poolPickerVisible: false,
      availablePoolTasks: [],
      poolSelectedIds: []
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
    }
  },
  onShow() {
    this.loadDailyTasks(this.currentDate)
  },
  methods: {
    showToast(title, icon = 'none') {
      uni.showToast({ title, icon, duration: 1800 })
    },
    getDailyStorageKey(dateStr) {
      return `${DAILY_KEY_PREFIX}${dateStr}`
    },
    statusLabel(status) {
      if (status === 'in_progress') {
        return '进行中'
      }
      if (status === 'completed') {
        return '已完成'
      }
      return '未开始'
    },
    statusClass(status) {
      if (status === 'in_progress') {
        return 'progress'
      }
      if (status === 'completed') {
        return 'done'
      }
      return 'default'
    },
    normalizeTask(raw, index = 0) {
      const images = Array.isArray(raw && raw.images)
        ? raw.images
        : Array.isArray(raw && raw.checkinImages)
          ? raw.checkinImages
          : []
      return {
        id: raw && raw.id ? raw.id : `daily_${Date.now()}_${index}`,
        name: raw && raw.name ? raw.name : '未命名任务',
        sortOrder: Number(raw && raw.sortOrder ? raw.sortOrder : index + 1),
        status: raw && raw.status ? raw.status : 'not_started',
        checkinText: raw && (raw.checkinText || raw.text || raw.content) ? (raw.checkinText || raw.text || raw.content) : '',
        images,
        video: raw && (raw.video || raw.videoPath) ? (raw.video || raw.videoPath) : ''
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
      const storageValue = getItem(this.getDailyStorageKey(dateStr))

      if (Array.isArray(storageValue)) {
        this.dailyTasks = storageValue
          .map((item, index) => this.normalizeTask(item, index))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        return
      }

      const existing = getDailyRecord(dateStr)
      if (Array.isArray(existing) && existing.length > 0) {
        this.dailyTasks = existing
          .map((item, index) => this.normalizeTask(item, index))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        return
      }

      const pool = getTaskPool().slice().sort((a, b) => {
        const sa = Number(a && a.sortOrder ? a.sortOrder : 0)
        const sb = Number(b && b.sortOrder ? b.sortOrder : 0)
        return sa - sb
      })

      if (pool.length === 0) {
        this.dailyTasks = []
        return
      }

      const initialized = pool.map((task, index) => this.sanitizeForDailyFromPool(task, index))
      this.dailyTasks = initialized
      setDailyRecord(dateStr, initialized)
    },
    goPrevDay() {
      this.currentDate = getPrevDay(this.currentDate)
      this.loadDailyTasks(this.currentDate)
    },
    onDatePick(e) {
      const value = e && e.detail && e.detail.value ? e.detail.value : ''
      if (!value) {
        return
      }
      this.currentDate = value
      this.loadDailyTasks(this.currentDate)
    },
    backToToday() {
      this.currentDate = getToday()
      this.loadDailyTasks(this.currentDate)
    },
    goNextDay() {
      this.currentDate = getNextDay(this.currentDate)
      this.loadDailyTasks(this.currentDate)
    },
    toggleTaskStatus(task) {
      const idx = this.dailyTasks.findIndex((item) => item.id === task.id)
      if (idx < 0) {
        return
      }
      const current = this.dailyTasks[idx].status || 'not_started'
      const currentIndex = STATUS_FLOW.indexOf(current)
      const nextStatus = STATUS_FLOW[(currentIndex + 1 + STATUS_FLOW.length) % STATUS_FLOW.length]
      this.dailyTasks[idx] = {
        ...this.dailyTasks[idx],
        status: nextStatus
      }
      this.saveCurrentDateTasks()
    },
    getPreviewText(task) {
      const text = String(task.checkinText || '').trim()
      if (!text) {
        return '暂无打卡内容'
      }
      if (text.length <= 20) {
        return text
      }
      return `${text.slice(0, 20)}...`
    },
    getFirstImage(task) {
      return Array.isArray(task.images) && task.images.length > 0 ? task.images[0] : ''
    },
    getVideoPath(task) {
      return task.video || ''
    },
    goDetail(task) {
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
      this.showToast('已同步任务到明天', 'success')
    },
    openManageMenu() {
      uni.showActionSheet({
        itemList: ['从任务池添加任务', '编辑当天任务列表'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.openPoolPicker()
          } else if (res.tapIndex === 1) {
            this.editPanelVisible = true
          }
        }
      })
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
      const values = (e && e.detail && e.detail.value) || []
      this.poolSelectedIds = values
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
    addSelectedFromPool() {
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
      uni.showModal({
        title: '删除当天任务',
        content: `确定删除「${task.name}」吗？`,
        confirmText: '删除',
        success: (res) => {
          if (!res.confirm) {
            return
          }
          this.dailyTasks = this.dailyTasks
            .filter((item) => item.id !== task.id)
            .map((item, index) => ({
              ...item,
              sortOrder: index + 1
            }))
          this.saveCurrentDateTasks()
          this.showToast('已删除', 'success')
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
  background: var(--mint-bg);

  --mint-bg: #eefcf8;
  --mint-card: #ffffff;
  --mint-title: #14322c;
  --mint-sub: #6b9388;
  --mint-border: #cdeee2;
  --mint-shadow: 0 10rpx 26rpx rgba(43, 132, 112, 0.12);
  --mint-primary: #43c5a1;
  --mint-primary-2: #2fa184;
  --mint-warn: #f0b251;
  --mint-done: #47b76f;
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

.date-center {
  flex: 1;
  text-align: center;
}

.date-picker {
  flex: 1;
}

.date-text {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--mint-title);
}

.today-btn {
  margin-right: 10rpx;
  padding: 0 14rpx;
  height: 50rpx;
  line-height: 50rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: var(--mint-primary-2);
  background: #e9f9f3;
}

.task-list {
  max-height: calc(100vh - 330rpx);
}

.empty-wrap {
  padding-top: 140rpx;
  text-align: center;
}

.empty-text {
  font-size: 30rpx;
  color: var(--mint-sub);
}

.task-card {
  background: var(--mint-card);
  border: 2rpx solid var(--mint-border);
  border-radius: 24rpx;
  box-shadow: var(--mint-shadow);
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.task-name {
  flex: 1;
  min-width: 0;
  font-size: 32rpx;
  color: var(--mint-title);
  font-weight: 600;
  word-break: break-all;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.status-tag {
  font-size: 22rpx;
  border-radius: 999rpx;
  padding: 8rpx 16rpx;
}

.status-tag.default {
  background: #f3f7f6;
  color: #6f8d84;
}

.status-tag.progress {
  background: #fff5df;
  color: #b8801d;
}

.status-tag.done {
  background: #e8f8ed;
  color: #2f8f4c;
}

.status-btn {
  width: 50rpx;
  height: 50rpx;
  line-height: 44rpx;
  text-align: center;
  font-size: 26rpx;
  color: #6f8d84;
  border-radius: 14rpx;
  background: #eff7f4;
}

.preview-row {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.preview-text {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: var(--mint-sub);
}

.preview-image,
.video-thumb {
  width: 96rpx;
  height: 96rpx;
  border-radius: 14rpx;
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
  font-size: 24rpx;
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
  font-size: 30rpx;
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
  font-size: 30rpx;
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
  font-size: 26rpx;
}

.sheet-item {
  height: 84rpx;
  border-radius: 16rpx;
  border: 2rpx solid var(--mint-border);
  padding: 0 20rpx;
  margin-bottom: 14rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-item.selectable {
  height: 92rpx;
}

.sheet-name {
  font-size: 28rpx;
  color: var(--mint-title);
}

.delete-btn,
.add-one {
  font-size: 26rpx;
  color: #e86a70;
}

.add-one {
  color: var(--mint-primary-2);
}

.sheet-add,
.sheet-close {
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
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
    --mint-bg: #10241f;
    --mint-card: #173730;
    --mint-title: #def5ee;
    --mint-sub: #91b8ae;
    --mint-border: #2b5950;
    --mint-shadow: 0 10rpx 26rpx rgba(0, 0, 0, 0.35);
    --mint-primary: #54d2ae;
    --mint-primary-2: #3ca98d;
  }

  .arrow,
  .status-btn,
  .today-btn {
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
