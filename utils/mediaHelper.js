const MEDIA_DIR = 'media'
const MAX_COMPRESS_RETRY = 3

function promisifyUni(api, options = {}) {
  return new Promise((resolve, reject) => {
    api({
      ...options,
      success: resolve,
      fail: reject
    })
  })
}

function getFileNameByPath(filePath, fallbackExt = '') {
  const cleanPath = String(filePath || '').split('?')[0]
  const rawName = cleanPath.substring(cleanPath.lastIndexOf('/') + 1)
  const hasExt = rawName.includes('.')
  if (rawName && hasExt) {
    return `${Date.now()}_${rawName}`
  }
  const ext = fallbackExt ? `.${fallbackExt.replace('.', '')}` : ''
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
}

async function getFileSize(filePath) {
  const info = await promisifyUni(uni.getFileInfo, { filePath })
  return Number(info.size || 0)
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0)
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  }
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function showErrorToast(message) {
  uni.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  })
}

function ensureAppMediaDir() {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    plus.io.requestFileSystem(
      plus.io.PRIVATE_DOC,
      (fs) => {
        fs.root.getDirectory(
          MEDIA_DIR,
          { create: true },
          (dirEntry) => resolve(dirEntry),
          (err) => reject(err)
        )
      },
      (err) => reject(err)
    )
    // #endif

    // #ifndef APP-PLUS
    reject(new Error('Not app-plus platform'))
    // #endif
  })
}

function copyFileToAppMedia(srcPath, fileName) {
  return new Promise(async (resolve, reject) => {
    // #ifdef APP-PLUS
    try {
      const dirEntry = await ensureAppMediaDir()
      plus.io.resolveLocalFileSystemURL(
        srcPath,
        (srcEntry) => {
          srcEntry.copyTo(
            dirEntry,
            fileName,
            (newEntry) => resolve(newEntry.toURL()),
            (err) => reject(err)
          )
        },
        (err) => reject(err)
      )
    } catch (error) {
      reject(error)
    }
    // #endif

    // #ifndef APP-PLUS
    reject(new Error('Not app-plus platform'))
    // #endif
  })
}

function copyFileToMpMedia(srcPath, fileName) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    try {
      const fs = wx.getFileSystemManager()
      const baseDir = `${wx.env.USER_DATA_PATH}/${MEDIA_DIR}`
      try {
        fs.mkdirSync(baseDir, true)
      } catch (mkdirErr) {
        if (!String(mkdirErr.errMsg || '').includes('file already exists')) {
          throw mkdirErr
        }
      }
      const targetPath = `${baseDir}/${fileName}`
      fs.copyFileSync(srcPath, targetPath)
      resolve(targetPath)
    } catch (error) {
      reject(error)
    }
    // #endif

    // #ifndef MP-WEIXIN
    reject(new Error('Not mp-weixin platform'))
    // #endif
  })
}

async function saveFileToMedia(tempFilePath, fallbackExt = '') {
  const fileName = getFileNameByPath(tempFilePath, fallbackExt)

  // #ifdef APP-PLUS
  return copyFileToAppMedia(tempFilePath, fileName)
  // #endif

  // #ifdef MP-WEIXIN
  return copyFileToMpMedia(tempFilePath, fileName)
  // #endif

  // #ifndef APP-PLUS
  // #ifndef MP-WEIXIN
  const result = await promisifyUni(uni.saveFile, { tempFilePath })
  return result.savedFilePath
  // #endif
  // #endif
}

async function compressImageRecursively(filePath, maxBytes, attempt = 0, quality = 80) {
  const currentSize = await getFileSize(filePath)
  if (currentSize <= maxBytes) {
    return filePath
  }

  if (attempt >= MAX_COMPRESS_RETRY) {
    throw new Error('IMAGE_TOO_LARGE_AFTER_COMPRESS')
  }

  const result = await promisifyUni(uni.compressImage, {
    src: filePath,
    quality
  })

  const nextQuality = Math.max(20, quality - 20)
  return compressImageRecursively(result.tempFilePath, maxBytes, attempt + 1, nextQuality)
}

async function compressAndSaveImage(tempFilePath, maxSizeMB = 5) {
  const maxBytes = Number(maxSizeMB) * 1024 * 1024

  try {
    const finalTempPath = await compressImageRecursively(tempFilePath, maxBytes)
    const finalSize = await getFileSize(finalTempPath)
    if (finalSize > maxBytes) {
      throw new Error('IMAGE_TOO_LARGE_AFTER_COMPRESS')
    }
    return await saveFileToMedia(finalTempPath, 'jpg')
  } catch (error) {
    if (error && error.message === 'IMAGE_TOO_LARGE_AFTER_COMPRESS') {
      showErrorToast(`Image still exceeds ${maxSizeMB}MB`)
    }
    throw error
  }
}

function normalizeVideoInput(input) {
  if (input && typeof input === 'object') {
    return {
      tempFilePath: input.tempFilePath || '',
      duration: Number(input.duration || 0),
      size: Number(input.size || 0)
    }
  }

  return {
    tempFilePath: String(input || ''),
    duration: 0,
    size: 0
  }
}

async function getVideoMeta(filePath) {
  try {
    const info = await promisifyUni(uni.getVideoInfo, { src: filePath })
    return {
      duration: Number(info.duration || 0),
      size: Number(info.size || 0)
    }
  } catch (error) {
    return { duration: 0, size: 0 }
  }
}

async function validateAndSaveVideo(tempFilePath, maxDurationSec = 300, maxSizeMB = 500) {
  const maxBytes = Number(maxSizeMB) * 1024 * 1024
  const input = normalizeVideoInput(tempFilePath)

  if (!input.tempFilePath) {
    throw new Error('INVALID_VIDEO_PATH')
  }

  let duration = input.duration
  let size = input.size

  // Prefer duration/size from chooseVideo result; fallback to local metadata.
  if (!duration || !size) {
    const meta = await getVideoMeta(input.tempFilePath)
    duration = duration || meta.duration
    size = size || meta.size
  }

  if (!size) {
    size = await getFileSize(input.tempFilePath)
  }

  if (duration > Number(maxDurationSec)) {
    showErrorToast(`Video duration cannot exceed ${maxDurationSec}s`)
    throw new Error('VIDEO_DURATION_EXCEEDED')
  }

  if (size > maxBytes) {
    showErrorToast(`Video size cannot exceed ${maxSizeMB}MB`)
    throw new Error('VIDEO_SIZE_EXCEEDED')
  }

  return saveFileToMedia(input.tempFilePath, 'mp4')
}

function removeByUni(filePath) {
  return promisifyUni(uni.removeSavedFile, { filePath })
}

function removeByPlusIO(filePath) {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    plus.io.resolveLocalFileSystemURL(
      filePath,
      (entry) => {
        entry.remove(
          () => resolve(true),
          (err) => reject(err)
        )
      },
      (err) => reject(err)
    )
    // #endif

    // #ifndef APP-PLUS
    reject(new Error('Not app-plus platform'))
    // #endif
  })
}

async function deleteMediaFile(filePath) {
  if (!filePath) {
    return false
  }

  // #ifdef APP-PLUS
  try {
    await removeByPlusIO(filePath)
    return true
  } catch (error) {
    // Ignore and fallback to removeSavedFile.
  }
  // #endif

  try {
    await removeByUni(filePath)
    return true
  } catch (error) {
    return false
  }
}

export {
  compressAndSaveImage,
  validateAndSaveVideo,
  deleteMediaFile,
  getFileSize,
  formatFileSize
}
