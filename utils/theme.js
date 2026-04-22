const THEME_VARS = {
  mint: {
    '--app-bg-color': '#eefcf8',
    '--app-nav-bg': '#e8faf4',
    '--bg-color': '#eefcf8',
    '--card-bg-color': '#ffffff',
    '--text-color': '#16342f',
    '--text-secondary-color': '#6c9489',
    '--primary-color': '#43c5a1'
  },
  'mint-dark': {
    '--app-bg-color': '#10241f',
    '--app-nav-bg': '#173730',
    '--bg-color': '#10241f',
    '--card-bg-color': '#173730',
    '--text-color': '#def5ee',
    '--text-secondary-color': '#92b9af',
    '--primary-color': '#54d2ae'
  },
  warm: {
    '--app-bg-color': '#fff7eb',
    '--app-nav-bg': '#ffeccc',
    '--bg-color': '#fff7eb',
    '--card-bg-color': '#ffffff',
    '--text-color': '#4f3520',
    '--text-secondary-color': '#99765a',
    '--primary-color': '#f0aa4b'
  },
  'warm-dark': {
    '--app-bg-color': '#2a1f16',
    '--app-nav-bg': '#38281b',
    '--bg-color': '#2a1f16',
    '--card-bg-color': '#38281b',
    '--text-color': '#fbe8d2',
    '--text-secondary-color': '#d0af8e',
    '--primary-color': '#f0b35f'
  },
  ocean: {
    '--app-bg-color': '#eaf4ff',
    '--app-nav-bg': '#dcecff',
    '--bg-color': '#eaf4ff',
    '--card-bg-color': '#ffffff',
    '--text-color': '#16355a',
    '--text-secondary-color': '#5f84ab',
    '--primary-color': '#4f98e0'
  },
  'ocean-dark': {
    '--app-bg-color': '#0e1e34',
    '--app-nav-bg': '#132a46',
    '--bg-color': '#0e1e34',
    '--card-bg-color': '#132a46',
    '--text-color': '#dcecff',
    '--text-secondary-color': '#9eb9d6',
    '--primary-color': '#68acef'
  }
}

const FONT_SIZE_MAP = {
  small: { rootPx: 14, varSize: '24rpx' },
  normal: { rootPx: 16, varSize: '28rpx' },
  large: { rootPx: 18, varSize: '32rpx' }
}

function applyCssVars(varMap) {
  // #ifdef H5
  if (typeof document !== 'undefined' && document.documentElement) {
    Object.keys(varMap).forEach((key) => {
      document.documentElement.style.setProperty(key, varMap[key])
    })
  }
  // #endif
}

function setTheme(themeName = 'mint') {
  const vars = THEME_VARS[themeName] || THEME_VARS.mint
  applyCssVars(vars)
  return vars
}

function setFontSize(level = 'normal') {
  const font = FONT_SIZE_MAP[level] || FONT_SIZE_MAP.normal
  applyCssVars({
    '--app-font-size': font.varSize
  })

  // #ifdef H5
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.fontSize = `${font.rootPx}px`
  }
  // #endif

  return font
}

export {
  setTheme,
  setFontSize
}
