/**
 * 技能中文描述配置
 * 为每个技能提供清晰的中文功能说明，让用户一眼就能明白这个技能是做什么的
 */

export interface SkillDescription {
  /** 显示名称（中文） */
  displayName: string;
  /** 一句话功能描述 */
  description: string;
  /** 使用场景提示 */
  usageHint?: string;
}

export const SKILL_DESCRIPTIONS: Record<string, SkillDescription> = {
  'tonight_composer': {
    displayName: '今晚结局',
    description: '告诉我你想要什么，我帮你找到今晚的落脚点',
    usageHint: '输入任何需求，如"找个安静的地方工作"'
  },
  'chill-place-picker': {
    displayName: '找个放松的地方',
    description: '帮你挑一个适合放空、发呆、或者什么都不做的地方',
    usageHint: '当你只想找个舒服的角落待着'
  },
  'coffee-dongwang': {
    displayName: '咖啡懂王',
    description: '按你的需求（提神/久坐/独处）推荐最合适的咖啡馆',
    usageHint: '想喝咖啡但不知道去哪家'
  },
  'micro-itinerary-curator': {
    displayName: '2小时微行程',
    description: '规划一个2-3小时的城市小探索，有主线有退路',
    usageHint: '有点时间想出去走走但没有目的地'
  },
  'inner-street-detour': {
    displayName: '小路绕行',
    description: '避开人流，走一条安静的小路回家或去目的地',
    usageHint: '不想走大路，想安静地走一段'
  },
  'budget-stroll-curator': {
    displayName: '穷游散步',
    description: '不花钱或少花钱的城市漫步路线',
    usageHint: '想出门但不想花钱'
  },
  'curate-rainy-day': {
    displayName: '雨天去处',
    description: '下雨天也能舒服待着的地方推荐',
    usageHint: '外面下雨但不想待在家'
  },
  'solo-meal-editor': {
    displayName: '一个人吃饭',
    description: '找一个适合独自用餐、不尴尬的餐厅',
    usageHint: '一个人想吃点好的'
  },
  'space-reviewer': {
    displayName: '空间测评',
    description: '用设计师的眼光帮你挑一个对脑子友好的空间',
    usageHint: '想找个有设计感、适合专注的地方'
  },
  'bookstore-refuge': {
    displayName: '书店避难所',
    description: '找一家适合躲进去看书、发呆的书店',
    usageHint: '想找个安静的书店待一会'
  },
  'attend-invisibly': {
    displayName: '隐形参与',
    description: '想去某个活动但不想社交，帮你规划隐身路线',
    usageHint: '想去看看但不想被注意到'
  },
  'draft-dazi-protocol': {
    displayName: '搭子协议',
    description: '帮你起草一份和搭子的默契协议',
    usageHint: '和朋友约出去但想保持边界感'
  },
  'follow-favorite-artists': {
    displayName: '追艺术家',
    description: '追踪你喜欢的艺术家的最新展览和活动',
    usageHint: '想知道喜欢的艺术家最近在哪展出'
  },
  'leave-exhibit-review': {
    displayName: '展览回响',
    description: '看完展览后，帮你记录和整理观展感受',
    usageHint: '刚看完展想记录点什么'
  },
  'plan-artwalk': {
    displayName: '艺术漫步',
    description: '规划一条串联多个艺术空间的步行路线',
    usageHint: '想一次看多个展览或画廊'
  },
  'plan-museum-sprint': {
    displayName: '博物馆速刷',
    description: '时间有限时，帮你规划博物馆的最佳参观路线',
    usageHint: '只有1-2小时但想逛博物馆'
  },
  'plan-architecture-citywalk': {
    displayName: '建筑漫游',
    description: '规划一条欣赏城市建筑的步行路线',
    usageHint: '想看看城市里有意思的建筑'
  },
  'plan-micro-exhibit-stop': {
    displayName: '快闪展打卡',
    description: '找到附近值得一看的小型展览或快闪活动',
    usageHint: '想看点新鲜的小展览'
  }
};

/**
 * 获取技能的中文描述
 */
export function getSkillDescription(skillId: string): SkillDescription | undefined {
  return SKILL_DESCRIPTIONS[skillId];
}

/**
 * 获取技能的显示名称（中文）
 */
export function getSkillDisplayName(skillId: string): string {
  return SKILL_DESCRIPTIONS[skillId]?.displayName || skillId;
}

/**
 * 获取技能的功能描述
 */
export function getSkillFunctionDescription(skillId: string): string {
  return SKILL_DESCRIPTIONS[skillId]?.description || '';
}
