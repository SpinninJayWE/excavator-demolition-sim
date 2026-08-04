export const GAME_VERSION = '1.0.0'

export const KEYMAP = [
  ['W / S', '前进 / 后退'],
  ['A / D', '左转 / 右转'],
  ['Q / E', '上车左转 / 右转'],
  ['R / F', '大臂 抬起 / 落下'],
  ['T / G', '斗杆 收 / 放'],
  ['Y / H', '铲斗 收 / 放'],
  ['C', '切换视角'],
  ['Space', '喇叭'],
  ['M', '静音'],
  ['P / Esc', '暂停'],
]

export const MAX_DEBRIS = 650
export const FIXED_STEP = 1 / 60

export const CAMERA_MODES = ['chase', 'orbit', 'cockpit']
export const CAMERA_NAMES = ['跟随视角', '自由视角', '驾驶舱']

export const MATERIALS = {
  brick: { key: 'brick', name: '砖块', value: 25, density: 1100, base: 0xa24b33, roughness: 0.92 },
  concrete: { key: 'concrete', name: '混凝土', value: 60, density: 1400, base: 0x8b8f96, roughness: 0.9 },
  steel: { key: 'steel', name: '钢板', value: 40, density: 1900, base: 0x9aa3ab, roughness: 0.42, metalness: 0.55 },
  wood: { key: 'wood', name: '木板', value: 12, density: 600, base: 0x8a6542, roughness: 0.95 },
  block: { key: 'block', name: '水泥砖', value: 20, density: 1000, base: 0x9b9a94, roughness: 0.95 },
  frame: { key: 'frame', name: '钢框架', value: 55, density: 1700, base: 0x4d5156, roughness: 0.5, metalness: 0.7 },
  red: { key: 'red', name: '红色面板', value: 15, density: 800, base: 0xe0483a, roughness: 0.72 },
  orange: { key: 'orange', name: '橙色面板', value: 15, density: 800, base: 0xf28c28, roughness: 0.72 },
  yellow: { key: 'yellow', name: '黄色面板', value: 15, density: 800, base: 0xf0c61e, roughness: 0.68 },
  green: { key: 'green', name: '绿色面板', value: 15, density: 800, base: 0x4fae4e, roughness: 0.72 },
  blue: { key: 'blue', name: '蓝色面板', value: 15, density: 800, base: 0x3f7fc2, roughness: 0.72 },
  purple: { key: 'purple', name: '紫色面板', value: 15, density: 800, base: 0x8b5bb4, roughness: 0.72 },
  teal: { key: 'teal', name: '青色面板', value: 15, density: 800, base: 0x2fa39b, roughness: 0.72 },
  white: { key: 'white', name: '白色墙体', value: 18, density: 900, base: 0xe8e2d8, roughness: 0.9 },
  stone: { key: 'stone', name: '石块', value: 30, density: 1200, base: 0x9a928a, roughness: 0.95 },
}

export const CONTRACTS = [
  {
    id: 'c1',
    name: '拆掉老仓库',
    desc: '用铲斗击碎仓库结构，破坏度达到 50%',
    target: 'warehouse',
    percent: 0.5,
    time: 240,
    reward: 6000,
  },
  {
    id: 'c2',
    name: '推平红砖房',
    desc: '彻底推平红砖小楼，破坏度达到 80%',
    target: 'house',
    percent: 0.8,
    time: 300,
    reward: 10000,
  },
  {
    id: 'c3',
    name: '高楼倒塌',
    desc: '瓦解混凝土塔楼，破坏度达到 70%',
    target: 'tower',
    percent: 0.7,
    time: 360,
    reward: 15000,
  },
  {
    id: 'c4',
    name: '清理废墟',
    desc: '将 60 块碎块推入回收坑（橙色标记处）',
    count: 60,
    time: 300,
    reward: 13000,
  },
  {
    id: 'c5',
    name: '限时拆迁王',
    desc: '3 分钟内赚取 30,000 元拆迁费',
    damageValue: 30000,
    time: 180,
    reward: 20000,
  },
]

export const FREE_MODE = {
  name: '自由拆迁',
  desc: '无时间限制，想拆哪就拆哪，实时结算拆迁费',
}

export function formatMoney(v) {
  return '¥' + Math.floor(v).toLocaleString('zh-CN')
}

export function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

const LS = {
  money: 'edm_money',
  unlocked: 'edm_unlocked',
  stats: 'edm_stats',
}

export function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(LS[key])
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}

export function saveLS(key, value) {
  try {
    localStorage.setItem(LS[key], JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
