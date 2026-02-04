// a2ui/storage.ts
// Nightfall 数据持久化工具函数

// ==================== 常量定义 ====================

const POCKET_STORAGE_KEY = 'nightfall_pocket_tickets';
const WHISPERS_STORAGE_KEY = 'nightfall_whispers';
const FOOTPRINTS_STORAGE_KEY = 'nightfall_footprints';
const VEIL_STORAGE_KEY = 'nightfall_veil';

// ==================== 类型定义 ====================

export interface StoredTicket {
  id: string;
  timestamp: number;
  title: string;
  subtitle: string;
  bundle: any; // 完整的票根数据
}

export interface StoredWhisper {
  id: string;
  timestamp: number;
  text: string;
  symbol: string;
}

export interface FootprintsStats {
  ticketsGenerated: number;
  focusMinutes: number;
  whispersWritten: number;
  placesVisited: number;
  lastActiveDate: string;
}

export interface VeilData {
  currentCover: string;
  lastUpdated: string;
}

// ==================== Pocket/Tickets 操作 ====================

/**
 * 获取所有已保存的票根
 */
export function getPocketTickets(): StoredTicket[] {
  try {
    const rawData = localStorage.getItem(POCKET_STORAGE_KEY);
    if (!rawData) return [];
    return JSON.parse(rawData) as StoredTicket[];
  } catch (error) {
    console.error("Failed to parse pocket tickets from localStorage", error);
    return [];
  }
}

/**
 * 保存票根到 Pocket
 */
export function saveTicketToPocket(bundle: any): StoredTicket {
  const tickets = getPocketTickets();
  
  const primaryEnding = bundle.primary_ending || bundle.primaryEnding || {};
  
  const newTicket: StoredTicket = {
    id: primaryEnding.id || `ticket_${Date.now()}`,
    timestamp: Date.now(),
    title: primaryEnding.title || 'Untitled Ending',
    subtitle: primaryEnding.subtitle || '',
    bundle: bundle,
  };

  // 避免重复添加（基于 id）
  const existingIndex = tickets.findIndex(t => t.id === newTicket.id);
  if (existingIndex !== -1) {
    tickets[existingIndex] = newTicket;
  } else {
    tickets.unshift(newTicket); // 新票根放在最前面
  }

  // 最多保存 50 个票根
  const trimmedTickets = tickets.slice(0, 50);
  
  localStorage.setItem(POCKET_STORAGE_KEY, JSON.stringify(trimmedTickets));
  
  // 同时更新 footprints 统计
  incrementFootprintsStat('ticketsGenerated');
  
  return newTicket;
}

/**
 * 删除指定票根
 */
export function deleteTicketFromPocket(ticketId: string): boolean {
  const tickets = getPocketTickets();
  const filteredTickets = tickets.filter(t => t.id !== ticketId);
  
  if (filteredTickets.length === tickets.length) {
    return false; // 没有找到要删除的票根
  }
  
  localStorage.setItem(POCKET_STORAGE_KEY, JSON.stringify(filteredTickets));
  return true;
}

/**
 * 清空所有票根
 */
export function clearAllTickets(): void {
  localStorage.removeItem(POCKET_STORAGE_KEY);
}

// ==================== Whispers 操作 ====================

/**
 * 获取所有低语
 */
export function getWhispers(): StoredWhisper[] {
  try {
    const rawData = localStorage.getItem(WHISPERS_STORAGE_KEY);
    if (!rawData) return [];
    return JSON.parse(rawData) as StoredWhisper[];
  } catch (error) {
    console.error("Failed to parse whispers from localStorage", error);
    return [];
  }
}

/**
 * 保存新低语
 */
export function saveWhisper(text: string, symbol: string = '◇'): StoredWhisper {
  const whispers = getWhispers();
  
  const newWhisper: StoredWhisper = {
    id: `whisper_${Date.now()}`,
    timestamp: Date.now(),
    text: text.trim(),
    symbol: symbol,
  };
  
  whispers.unshift(newWhisper);
  
  // 最多保存 100 条低语
  const trimmedWhispers = whispers.slice(0, 100);
  
  localStorage.setItem(WHISPERS_STORAGE_KEY, JSON.stringify(trimmedWhispers));
  
  // 同时更新 footprints 统计
  incrementFootprintsStat('whispersWritten');
  
  return newWhisper;
}

/**
 * 删除指定低语
 */
export function deleteWhisper(whisperId: string): boolean {
  const whispers = getWhispers();
  const filteredWhispers = whispers.filter(w => w.id !== whisperId);
  
  if (filteredWhispers.length === whispers.length) {
    return false;
  }
  
  localStorage.setItem(WHISPERS_STORAGE_KEY, JSON.stringify(filteredWhispers));
  return true;
}

// ==================== Footprints 操作 ====================

/**
 * 获取足迹统计
 */
export function getFootprints(): FootprintsStats {
  try {
    const rawData = localStorage.getItem(FOOTPRINTS_STORAGE_KEY);
    if (!rawData) {
      return getDefaultFootprints();
    }
    return JSON.parse(rawData) as FootprintsStats;
  } catch (error) {
    console.error("Failed to parse footprints from localStorage", error);
    return getDefaultFootprints();
  }
}

/**
 * 获取默认足迹统计
 */
function getDefaultFootprints(): FootprintsStats {
  return {
    ticketsGenerated: 0,
    focusMinutes: 0,
    whispersWritten: 0,
    placesVisited: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * 增加足迹统计项
 */
export function incrementFootprintsStat(
  stat: keyof Omit<FootprintsStats, 'lastActiveDate'>,
  amount: number = 1
): void {
  const footprints = getFootprints();
  footprints[stat] = (footprints[stat] || 0) + amount;
  footprints.lastActiveDate = new Date().toISOString().split('T')[0];
  localStorage.setItem(FOOTPRINTS_STORAGE_KEY, JSON.stringify(footprints));
}

/**
 * 添加专注时间
 */
export function addFocusMinutes(minutes: number): void {
  incrementFootprintsStat('focusMinutes', minutes);
}

/**
 * 记录访问地点
 */
export function recordPlaceVisit(): void {
  incrementFootprintsStat('placesVisited');
}

// ==================== Veil 操作 ====================

/**
 * 获取 Veil 数据
 */
export function getVeilData(): VeilData {
  try {
    const rawData = localStorage.getItem(VEIL_STORAGE_KEY);
    if (!rawData) {
      return {
        currentCover: '',
        lastUpdated: '',
      };
    }
    return JSON.parse(rawData) as VeilData;
  } catch (error) {
    console.error("Failed to parse veil data from localStorage", error);
    return {
      currentCover: '',
      lastUpdated: '',
    };
  }
}

/**
 * 保存 Veil 封面
 */
export function saveVeilCover(coverUrl: string): void {
  const veilData: VeilData = {
    currentCover: coverUrl,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(VEIL_STORAGE_KEY, JSON.stringify(veilData));
}

// ==================== 导出所有函数 ====================

export const storage = {
  // Tickets
  getPocketTickets,
  saveTicketToPocket,
  deleteTicketFromPocket,
  clearAllTickets,
  
  // Whispers
  getWhispers,
  saveWhisper,
  deleteWhisper,
  
  // Footprints
  getFootprints,
  incrementFootprintsStat,
  addFocusMinutes,
  recordPlaceVisit,
  
  // Veil
  getVeilData,
  saveVeilCover,
};

export default storage;
