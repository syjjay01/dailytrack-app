<template>
  <view class="task-pool-page">
    <view class="header">
      <view>
        <text class="title">任务池管理</text>
        <text class="subtitle">{{ taskPool.length }}/20 个任务</text>
      </view>
      <button class="sort-mode-btn" @click="toggleSortMode">
        {{ isSortMode ? '完成排序' : '排序模式' }}
      </button>
    </view>

    <scroll-view class="list-wrap" scroll-y>
      <view v-if="taskPool.length === 0" class="empty-wrap">
        <text class="empty-text">还没有任务，点击下方按钮新增吧</text>
      </view>

      <view v-else>
        <view class="task-item" v-for="(task, index) in taskPool" :key="task.id">
          <view class="task-main">
            <text class="task-name">{{ task.name }}</text>
          </view>

          <view v-if="!isSortMode" class="task-actions">
            <text class="action-btn" @click="openEditDialog(task)">✏️</text>
            <text class="action-btn" @click="handleDelete(task)">🗑️</text>
          </view>

          <view v-else class="sort-actions">
            <button class="sort-btn" :disabled="index === 0" @click="moveTaskUp(index)">上移</button>
            <button
              class="sort-btn"
              :disabled="index === taskPool.length - 1"
              @click="moveTaskDown(index)"
            >
              下移
            </button>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-actions">
      <button class="add-btn" @click="openAddDialog">新增任务</button>
    </view>

    <view v-if="dialogVisible" class="dialog-mask" @click="closeDialog">
      <view class="dialog-card" @click.stop>
        <text class="dialog-title">{{ dialogTitle }}</text>
        <input
          v-model.trim="dialogInput"
          class="dialog-input"
          placeholder="请输入任务名称（最多20字）"
          maxlength="20"
        />
        <view class="dialog-actions">
          <button class="dialog-btn cancel" @click="closeDialog">取消</button>
          <button class="dialog-btn confirm" @click="confirmDialog">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getTaskPool, setTaskPool } from '@/utils/storage.js'

const MAX_TASK_COUNT = 20

export default {
  data() {
    return {
      taskPool: [],
      isSortMode: false,
      dialogVisible: false,
      dialogType: 'add',
      dialogTitle: '',
      dialogInput: '',
      editingTaskId: ''
    }
  },
  onShow() {
    this.loadTaskPool()
  },
  methods: {
    showToast(title, icon = 'none') {
      uni.showToast({
        title,
        icon,
        duration: 1800
      })
    },
    loadTaskPool() {
      const list = getTaskPool()
      this.taskPool = this.normalizeTaskList(list)
    },
    normalizeTaskList(list) {
      const source = Array.isArray(list) ? list.slice() : []
      source.sort((a, b) => {
        const sa = Number(a && a.sortOrder ? a.sortOrder : 0)
        const sb = Number(b && b.sortOrder ? b.sortOrder : 0)
        if (sa === sb) {
          return 0
        }
        return sa - sb
      })
      return source.map((item, index) => ({
        id: item && item.id ? item.id : `task_${Date.now()}_${index}`,
        name: item && item.name ? item.name : '',
        sortOrder: index + 1
      }))
    },
    persistTaskPool(list) {
      const normalized = this.normalizeTaskList(list).map((item, index) => ({
        ...item,
        sortOrder: index + 1
      }))
      this.taskPool = normalized
      setTaskPool(normalized)
    },
    toggleSortMode() {
      this.isSortMode = !this.isSortMode
      if (!this.isSortMode) {
        this.showToast('排序已保存', 'success')
      }
    },
    openAddDialog() {
      if (this.taskPool.length >= MAX_TASK_COUNT) {
        this.showToast('任务池最多只能添加20个任务')
        return
      }
      this.dialogType = 'add'
      this.dialogTitle = '新增任务'
      this.dialogInput = ''
      this.editingTaskId = ''
      this.dialogVisible = true
    },
    openEditDialog(task) {
      this.dialogType = 'edit'
      this.dialogTitle = '编辑任务'
      this.dialogInput = task.name
      this.editingTaskId = task.id
      this.dialogVisible = true
    },
    closeDialog() {
      this.dialogVisible = false
    },
    confirmDialog() {
      const name = String(this.dialogInput || '').trim()
      if (!name) {
        this.showToast('任务名称不能为空')
        return
      }
      if (name.length > 20) {
        this.showToast('任务名称不能超过20字')
        return
      }

      if (this.dialogType === 'add') {
        const nextTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          sortOrder: this.taskPool.length + 1
        }
        this.persistTaskPool([...this.taskPool, nextTask])
        this.showToast('新增成功', 'success')
      } else {
        const nextList = this.taskPool.map((item) => {
          if (item.id === this.editingTaskId) {
            return {
              ...item,
              name
            }
          }
          return item
        })
        this.persistTaskPool(nextList)
        this.showToast('修改成功', 'success')
      }

      this.closeDialog()
    },
    handleDelete(task) {
      uni.showModal({
        title: '删除任务',
        content: `确定删除任务「${task.name}」吗？`,
        confirmText: '删除',
        confirmColor: '#e85f64',
        success: (res) => {
          if (!res.confirm) {
            return
          }
          const nextList = this.taskPool.filter((item) => item.id !== task.id)
          this.persistTaskPool(nextList)
          this.showToast('删除成功', 'success')
        }
      })
    },
    moveTaskUp(index) {
      if (index <= 0) {
        return
      }
      const list = this.taskPool.slice()
      const temp = list[index - 1]
      list[index - 1] = list[index]
      list[index] = temp
      this.persistTaskPool(list)
    },
    moveTaskDown(index) {
      if (index >= this.taskPool.length - 1) {
        return
      }
      const list = this.taskPool.slice()
      const temp = list[index + 1]
      list[index + 1] = list[index]
      list[index] = temp
      this.persistTaskPool(list)
    }
  }
}
</script>

<style scoped>
.task-pool-page {
  min-height: 100vh;
  background: var(--mint-bg);
  padding: 30rpx 28rpx 180rpx;
  box-sizing: border-box;

  --mint-bg: #eefcf8;
  --mint-card-bg: #ffffff;
  --mint-title: #173730;
  --mint-subtitle: #689489;
  --mint-border: #cdeee2;
  --mint-shadow: 0 8rpx 24rpx rgba(43, 132, 112, 0.1);
  --mint-accent: #43c5a1;
  --mint-accent-strong: #2fa184;
  --mint-danger: #e85f64;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--mint-title);
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--mint-subtitle);
}

.sort-mode-btn {
  margin: 0;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: var(--mint-accent-strong);
  background: #e8faf4;
  border: 2rpx solid var(--mint-border);
}

.sort-mode-btn::after {
  border: none;
}

.list-wrap {
  max-height: calc(100vh - 260rpx);
}

.empty-wrap {
  margin-top: 80rpx;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: var(--mint-subtitle);
}

.task-item {
  background: var(--mint-card-bg);
  border: 2rpx solid var(--mint-border);
  border-radius: 24rpx;
  box-shadow: var(--mint-shadow);
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.task-main {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 30rpx;
  color: var(--mint-title);
  word-break: break-all;
}

.task-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.action-btn {
  font-size: 36rpx;
}

.sort-actions {
  display: flex;
  gap: 12rpx;
}

.sort-btn {
  margin: 0;
  min-width: 110rpx;
  height: 58rpx;
  line-height: 58rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  color: var(--mint-accent-strong);
  background: #effaf6;
  border: 2rpx solid var(--mint-border);
}

.sort-btn::after {
  border: none;
}

.sort-btn[disabled] {
  opacity: 0.45;
}

.bottom-actions {
  position: fixed;
  left: 28rpx;
  right: 28rpx;
  bottom: 40rpx;
}

.add-btn {
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 999rpx;
  border: none;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  background: linear-gradient(120deg, var(--mint-accent) 0%, var(--mint-accent-strong) 100%);
  box-shadow: 0 14rpx 28rpx rgba(47, 161, 132, 0.3);
}

.add-btn::after {
  border: none;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
  z-index: 99;
}

.dialog-card {
  width: 100%;
  background: var(--mint-card-bg);
  border-radius: 24rpx;
  padding: 28rpx;
  box-sizing: border-box;
}

.dialog-title {
  display: block;
  font-size: 32rpx;
  color: var(--mint-title);
  font-weight: 600;
  margin-bottom: 20rpx;
}

.dialog-input {
  height: 84rpx;
  border: 2rpx solid var(--mint-border);
  border-radius: 16rpx;
  background: #f7fffc;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: var(--mint-title);
}

.dialog-actions {
  display: flex;
  gap: 18rpx;
  margin-top: 26rpx;
}

.dialog-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
  margin: 0;
}

.dialog-btn::after {
  border: none;
}

.dialog-btn.cancel {
  background: #f0f6f4;
  color: #607b74;
}

.dialog-btn.confirm {
  background: var(--mint-accent);
  color: #ffffff;
}

@media (prefers-color-scheme: dark) {
  .task-pool-page {
    --mint-bg: #10241f;
    --mint-card-bg: #173730;
    --mint-title: #def5ee;
    --mint-subtitle: #90b7ac;
    --mint-border: #2b5950;
    --mint-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.32);
    --mint-accent: #54d2ae;
    --mint-accent-strong: #3ca98d;
    --mint-danger: #f17f83;
  }

  .sort-mode-btn,
  .sort-btn {
    background: #1e443b;
  }

  .dialog-input {
    background: #1b4038;
  }
}
</style>
