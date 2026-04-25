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

function getCurrentUsername() {
  const user = getCurrentUser()
  return user && user.username ? String(user.username) : ''
}

function buildUserScopedKey(baseKey, username) {
  const userKey = String(username || getCurrentUsername() || 'default')
  return `${baseKey}__${userKey}`
}

function getTaskPoolKey(username) {
  return buildUserScopedKey(TASK_POOL_KEY, username)
}

function getTaskPool() {
  const scopedKey = getTaskPoolKey()
  const list = getItem(scopedKey)
  if (Array.isArray(list)) {
    return list
  }

  // Backward compatibility: migrate legacy unscoped task pool to current user scope.
  const legacy = getItem(TASK_POOL_KEY)
  if (Array.isArray(legacy)) {
    setItem(scopedKey, legacy)
    return legacy
  }

  return []
}

function setTaskPool(taskPool) {
  setItem(getTaskPoolKey(), Array.isArray(taskPool) ? taskPool : [])
}

function getDailyRecordPrefix(username) {
  return buildUserScopedKey(DAILY_RECORD_PREFIX, username)
}

function getDailyRecordKey(date, username) {
  return `${getDailyRecordPrefix(username)}_${date}`
}

function getDailyRecord(date) {
  const scopedKey = getDailyRecordKey(date)
  const list = getItem(scopedKey)
  if (Array.isArray(list)) {
    return list
  }

  // Backward compatibility: migrate legacy unscoped daily record to current user scope.
  const legacyKey = `${DAILY_RECORD_PREFIX}${date}`
  const legacy = getItem(legacyKey)
  if (Array.isArray(legacy)) {
    setItem(scopedKey, legacy)
    return legacy
  }

  return []
}

function setDailyRecord(date, data) {
  setItem(getDailyRecordKey(date), Array.isArray(data) ? data : [])
}

function clearCurrentUserSession() {
  removeItem(CURRENT_USER_KEY)
}

function removeUserData(username) {
  const scopedTaskKey = getTaskPoolKey(username)
  removeItem(scopedTaskKey)

  const scopedDailyPrefix = getDailyRecordPrefix(username)
  const info = uni.getStorageInfoSync()
  const keys = (info && info.keys) || []
  keys
    .filter((key) => String(key).startsWith(`${scopedDailyPrefix}_`))
    .forEach((key) => removeItem(key))
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
  DAILY_RECORD_PREFIX,
  setItem,
  getItem,
  removeItem,
  getCurrentUser,
  getCurrentUsername,
  setCurrentUser,
  clearCurrentUserSession,
  getTaskPool,
  setTaskPool,
  getTaskPoolKey,
  getDailyRecordKey,
  getDailyRecordPrefix,
  getDailyRecord,
  setDailyRecord,
  removeUserData,
  getAllUsers,
  saveUser
}
