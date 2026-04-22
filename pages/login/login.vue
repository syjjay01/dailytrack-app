<template>
  <view class="login-page">
    <view class="bg-decoration bg-1"></view>
    <view class="bg-decoration bg-2"></view>

    <view class="panel">
      <view class="brand">
        <text class="brand-title">日迹打卡</text>
        <text class="brand-subtitle">轻量记录每一天</text>
      </view>

      <view class="tabs">
        <view
          class="tab-item"
          :class="{ active: activeTab === 'login' }"
          @click="switchTab('login')"
        >
          登录
        </view>
        <view
          class="tab-item"
          :class="{ active: activeTab === 'register' }"
          @click="switchTab('register')"
        >
          注册
        </view>
      </view>

      <view v-if="activeTab === 'login'" class="form">
        <view class="field">
          <text class="field-label">用户名</text>
          <input
            v-model.trim="loginForm.username"
            class="field-input"
            placeholder="请输入用户名"
            maxlength="20"
          />
        </view>

        <view class="field">
          <text class="field-label">密码</text>
          <input
            v-model="loginForm.password"
            class="field-input"
            placeholder="请输入密码"
            password
            maxlength="20"
          />
        </view>

        <button class="submit-btn" @click="handleLogin">登录</button>
      </view>

      <view v-else class="form">
        <view class="field">
          <text class="field-label">用户名</text>
          <input
            v-model.trim="registerForm.username"
            class="field-input"
            placeholder="字母/数字/下划线，3~20位"
            maxlength="20"
          />
        </view>

        <view class="field">
          <text class="field-label">密码</text>
          <input
            v-model="registerForm.password"
            class="field-input"
            placeholder="请输入6~20位密码"
            password
            maxlength="20"
          />
        </view>

        <view class="field">
          <text class="field-label">确认密码</text>
          <input
            v-model="registerForm.confirmPassword"
            class="field-input"
            placeholder="请再次输入密码"
            password
            maxlength="20"
          />
        </view>

        <button class="submit-btn" @click="handleRegister">注册并进入</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getAllUsers, saveUser, setCurrentUser } from '@/utils/storage.js'

const USERNAME_REG = /^[A-Za-z0-9_]{3,20}$/

export default {
  data() {
    return {
      activeTab: 'login',
      loginForm: {
        username: '',
        password: ''
      },
      registerForm: {
        username: '',
        password: '',
        confirmPassword: ''
      }
    }
  },
  methods: {
    switchTab(tab) {
      this.activeTab = tab
    },
    showToast(title, icon = 'none') {
      uni.showToast({
        title,
        icon,
        duration: 1800
      })
    },
    normalizeUsername(username) {
      return String(username || '').trim()
    },
    findUser(username) {
      const allUsers = getAllUsers()
      return allUsers.find((item) => item && item.username === username)
    },
    handleRegister() {
      const username = this.normalizeUsername(this.registerForm.username)
      const password = this.registerForm.password
      const confirmPassword = this.registerForm.confirmPassword

      if (!USERNAME_REG.test(username)) {
        this.showToast('用户名需为3~20位字母数字下划线')
        return
      }

      if (password.length < 6 || password.length > 20) {
        this.showToast('密码长度需为6~20位')
        return
      }

      if (confirmPassword !== password) {
        this.showToast('两次输入的密码不一致')
        return
      }

      if (this.findUser(username)) {
        this.showToast('用户名已存在，请更换')
        return
      }

      const user = {
        username,
        password,
        createdAt: Date.now()
      }

      saveUser(user)
      setCurrentUser(user)
      this.showToast('注册成功', 'success')
      setTimeout(() => {
        uni.switchTab({
          url: '/pages/home/home'
        })
      }, 300)
    },
    handleLogin() {
      const username = this.normalizeUsername(this.loginForm.username)
      const password = this.loginForm.password

      if (!username || !password) {
        this.showToast('请输入用户名和密码')
        return
      }

      const user = this.findUser(username)
      if (!user) {
        this.showToast('用户不存在，请先注册')
        return
      }

      if (user.password !== password) {
        this.showToast('密码错误，请重试')
        return
      }

      setCurrentUser(user)
      this.showToast('登录成功', 'success')
      setTimeout(() => {
        uni.switchTab({
          url: '/pages/home/home'
        })
      }, 300)
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 70rpx 28rpx;
  box-sizing: border-box;
  background: var(--mint-bg);
  position: relative;
  overflow: hidden;

  --mint-bg: linear-gradient(180deg, #eefcf8 0%, #e2f5ee 100%);
  --mint-panel-bg: rgba(255, 255, 255, 0.94);
  --mint-text-primary: #16342f;
  --mint-text-secondary: #5c7c74;
  --mint-accent: #43c5a1;
  --mint-accent-strong: #2fa184;
  --mint-input-bg: #f5fffb;
  --mint-border: #cdeee2;
  --mint-shadow: 0 16rpx 60rpx rgba(43, 132, 112, 0.15);
}

.bg-decoration {
  position: absolute;
  border-radius: 999rpx;
  filter: blur(2rpx);
}

.bg-1 {
  width: 380rpx;
  height: 380rpx;
  right: -120rpx;
  top: -80rpx;
  background: rgba(94, 212, 181, 0.24);
}

.bg-2 {
  width: 280rpx;
  height: 280rpx;
  left: -80rpx;
  bottom: 100rpx;
  background: rgba(130, 226, 202, 0.3);
}

.panel {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 670rpx;
  margin: 0 auto;
  padding: 52rpx 40rpx;
  border-radius: 32rpx;
  background: var(--mint-panel-bg);
  box-shadow: var(--mint-shadow);
  border: 2rpx solid var(--mint-border);
  box-sizing: border-box;
}

.brand {
  margin-bottom: 36rpx;
}

.brand-title {
  display: block;
  font-size: 48rpx;
  line-height: 1.2;
  font-weight: 700;
  color: var(--mint-text-primary);
}

.brand-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--mint-text-secondary);
}

.tabs {
  display: flex;
  background: var(--mint-input-bg);
  border-radius: 999rpx;
  padding: 8rpx;
  margin-bottom: 36rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 999rpx;
  font-size: 28rpx;
  color: var(--mint-text-secondary);
  transition: all 0.2s ease;
}

.tab-item.active {
  color: #ffffff;
  background: var(--mint-accent);
  font-weight: 600;
  box-shadow: 0 8rpx 20rpx rgba(67, 197, 161, 0.35);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.field-label {
  font-size: 26rpx;
  color: var(--mint-text-primary);
}

.field-input {
  width: 100%;
  height: 86rpx;
  border-radius: 20rpx;
  border: 2rpx solid var(--mint-border);
  background: var(--mint-input-bg);
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--mint-text-primary);
  box-sizing: border-box;
}

.submit-btn {
  margin-top: 20rpx;
  height: 88rpx;
  line-height: 88rpx;
  border: none;
  border-radius: 999rpx;
  background: linear-gradient(120deg, var(--mint-accent) 0%, var(--mint-accent-strong) 100%);
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 12rpx 26rpx rgba(47, 161, 132, 0.35);
}

.submit-btn::after {
  border: none;
}

@media (prefers-color-scheme: dark) {
  .login-page {
    --mint-bg: linear-gradient(180deg, #10241f 0%, #0d1c18 100%);
    --mint-panel-bg: rgba(20, 40, 35, 0.94);
    --mint-text-primary: #def5ee;
    --mint-text-secondary: #93b9af;
    --mint-accent: #54d2ae;
    --mint-accent-strong: #3ca98d;
    --mint-input-bg: #173730;
    --mint-border: #2a584e;
    --mint-shadow: 0 20rpx 70rpx rgba(0, 0, 0, 0.4);
  }

  .bg-1 {
    background: rgba(84, 210, 174, 0.18);
  }

  .bg-2 {
    background: rgba(69, 167, 141, 0.2);
  }
}

@media screen and (max-width: 380px) {
  .panel {
    padding: 42rpx 24rpx;
  }
}
</style>
