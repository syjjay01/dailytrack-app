function padZero(value) {
  return String(value).padStart(2, '0')
}

function parseDateInput(input) {
  if (input instanceof Date) {
    return new Date(input.getTime())
  }

  if (typeof input === 'string') {
    const normalized = input.trim().replace(/\//g, '-')
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2]) - 1
      const day = Number(match[3])
      return new Date(year, month, day)
    }
  }

  return new Date(input)
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function formatDate(date, pattern = 'YYYY-MM-DD') {
  const parsed = parseDateInput(date)
  if (!isValidDate(parsed)) {
    return ''
  }

  const year = parsed.getFullYear()
  const month = parsed.getMonth() + 1
  const day = parsed.getDate()
  const hour = parsed.getHours()
  const minute = parsed.getMinutes()
  const second = parsed.getSeconds()

  const tokenMap = {
    YYYY: String(year),
    MM: padZero(month),
    DD: padZero(day),
    HH: padZero(hour),
    mm: padZero(minute),
    ss: padZero(second)
  }

  let result = pattern
  Object.keys(tokenMap).forEach((token) => {
    result = result.replace(new RegExp(token, 'g'), tokenMap[token])
  })

  return result
}

function getToday() {
  return formatDate(new Date(), 'YYYY-MM-DD')
}

function addDays(dateStr, offset) {
  const date = parseDateInput(dateStr)
  if (!isValidDate(date)) {
    return ''
  }
  date.setDate(date.getDate() + offset)
  return formatDate(date, 'YYYY-MM-DD')
}

function getNextDay(dateStr) {
  return addDays(dateStr, 1)
}

function getPrevDay(dateStr) {
  return addDays(dateStr, -1)
}

function isSameDay(date1, date2) {
  const d1 = parseDateInput(date1)
  const d2 = parseDateInput(date2)
  if (!isValidDate(d1) || !isValidDate(d2)) {
    return false
  }
  return formatDate(d1, 'YYYY-MM-DD') === formatDate(d2, 'YYYY-MM-DD')
}

function getWeekday(dateStr) {
  const date = parseDateInput(dateStr)
  if (!isValidDate(date)) {
    return ''
  }
  const weekdayMap = ['\u5468\u65e5', '\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d']
  return weekdayMap[date.getDay()]
}

export {
  formatDate,
  getToday,
  getNextDay,
  getPrevDay,
  isSameDay,
  getWeekday
}
