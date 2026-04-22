const CURRENT_USER_KEY = 'currentUser'
const TASK_POOL_KEY = 'taskPool'
const USERS_KEY = 'users'
const DAILY_RECORD_PREFIX = 'dailyRecord_'

function tryParseJSON(value) {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    return value
  }
}

function setItem(key, value) {
  const isObjectValue = value !== null && typeof value === 'object'
  const data = isObjectValue ? JSON.stringify(value) : value
  uni.setStorageSync(key, data)
}

function getItem(key) {
  const value = uni.getStorageSync(key)
  return tryParseJSON(value)
}

function removeItem(key) {
  uni.removeStorageSync(key)
}

function getCurrentUser() {
  return getItem(CURRENT_USER_KEY) || null
}

function setCurrentUser(user) {
  setItem(CURRENT_USER_KEY, user)
}

function getTaskPool() {
  const list = getItem(TASK_POOL_KEY)
  return Array.isArray(list) ? list : []
}

function setTaskPool(taskPool) {
  setItem(TASK_POOL_KEY, Array.isArray(taskPool) ? taskPool : [])
}

function getDailyRecordKey(date) {
  return `${DAILY_RECORD_PREFIX}${date}`
}

function getDailyRecord(date) {
  const list = getItem(getDailyRecordKey(date))
  return Array.isArray(list) ? list : []
}

function setDailyRecord(date, data) {
  setItem(getDailyRecordKey(date), Array.isArray(data) ? data : [])
}

function getAllUsers() {
  const users = getItem(USERS_KEY)
  return Array.isArray(users) ? users : []
}

function saveUser(user) {
  const users = getAllUsers()
  const username = user && user.username

  if (!username) {
    return
  }

  const index = users.findIndex((item) => item && item.username === username)
  if (index >= 0) {
    users[index] = user
  } else {
    users.push(user)
  }

  setItem(USERS_KEY, users)
}

export {
  CURRENT_USER_KEY,
  TASK_POOL_KEY,
  USERS_KEY,
  setItem,
  getItem,
  removeItem,
  getCurrentUser,
  setCurrentUser,
  getTaskPool,
  setTaskPool,
  getDailyRecord,
  setDailyRecord,
  getAllUsers,
  saveUser
}
