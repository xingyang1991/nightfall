/**
 * 高德地图 API 服务
 * 用于搜索真实地点、获取照片、计算距离等
 */

const AMAP_API_KEY = process.env.AMAP_API_KEY || '';

export interface AmapPlace {
  id: string;
  name: string;
  type: string;           // 类型，如"咖啡厅"
  typecode: string;       // 类型编码
  address: string;
  location: string;       // "lng,lat"
  lat: number;
  lng: number;
  distance?: number;      // 距离（米），仅周边搜索时有
  tel?: string;
  rating?: string;        // 评分，如"4.9"
  cost?: string;          // 人均消费
  opentime?: string;      // 营业时间
  photos: AmapPhoto[];
  biz_ext?: {
    rating?: string;
    cost?: string;
    open_time?: string;
  };
}

export interface AmapPhoto {
  title: string;
  url: string;
}

export interface SearchOptions {
  keywords: string;
  city?: string;
  location?: string;      // "lng,lat" 用于周边搜索
  radius?: number;        // 搜索半径（米），默认3000
  types?: string;         // POI类型，如"050000"（餐饮）
  offset?: number;        // 返回数量，默认10
  page?: number;
  extensions?: 'base' | 'all';
}

/**
 * 关键词搜索地点
 */
export async function searchPlaces(options: SearchOptions): Promise<AmapPlace[]> {
  if (!AMAP_API_KEY) {
    console.error('[AMAP] API Key not configured');
    return [];
  }

  const params = new URLSearchParams({
    key: AMAP_API_KEY,
    keywords: options.keywords,
    city: options.city || '上海',
    offset: String(options.offset || 10),
    page: String(options.page || 1),
    extensions: options.extensions || 'all',
    output: 'json'
  });

  if (options.types) {
    params.set('types', options.types);
  }

  try {
    const url = `https://restapi.amap.com/v3/place/text?${params.toString()}`;
    console.log('[AMAP] Searching places:', options.keywords);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1') {
      console.error('[AMAP] Search failed:', data.info);
      return [];
    }

    return parsePoiList(data.pois || []);
  } catch (error) {
    console.error('[AMAP] Search error:', error);
    return [];
  }
}

/**
 * 周边搜索地点（基于用户位置）
 */
export async function searchNearby(options: SearchOptions): Promise<AmapPlace[]> {
  if (!AMAP_API_KEY) {
    console.error('[AMAP] API Key not configured');
    return [];
  }

  if (!options.location) {
    console.error('[AMAP] Location required for nearby search');
    return searchPlaces(options); // 降级为关键词搜索
  }

  const params = new URLSearchParams({
    key: AMAP_API_KEY,
    keywords: options.keywords,
    location: options.location,
    radius: String(options.radius || 3000),
    offset: String(options.offset || 10),
    page: String(options.page || 1),
    extensions: options.extensions || 'all',
    sortrule: 'distance', // 按距离排序
    output: 'json'
  });

  if (options.types) {
    params.set('types', options.types);
  }

  try {
    const url = `https://restapi.amap.com/v3/place/around?${params.toString()}`;
    console.log('[AMAP] Searching nearby:', options.keywords, 'at', options.location);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1') {
      console.error('[AMAP] Nearby search failed:', data.info);
      return [];
    }

    return parsePoiList(data.pois || []);
  } catch (error) {
    console.error('[AMAP] Nearby search error:', error);
    return [];
  }
}

/**
 * 根据需求类型生成搜索关键词
 */
export function getSearchKeywords(userIntent: string): { keywords: string; types?: string }[] {
  const intent = userIntent.toLowerCase();
  
  // 技能名称映射 - 移除 types 参数以避免高德 API 返回错误类型的结果
  const skillKeywordMap: Record<string, { keywords: string; types?: string }[]> = {
    '咖啡懂王': [
      { keywords: '咖啡馆' },
      { keywords: '精品咖啡' },
      { keywords: 'Manner Coffee' }
    ],
    '书店避难所': [
      { keywords: '书店' },
      { keywords: '独立书店' },
      { keywords: '24小时书店' }
    ],
    '今晚结局': [
      { keywords: '咖啡馆' },
      { keywords: '书店' },
      { keywords: '酒吧' }
    ],
    '隐形参与': [
      { keywords: '展览馆' },
      { keywords: '艺术中心' },
      { keywords: '画廊' }
    ],
    '穷游散步': [
      { keywords: '公园' },
      { keywords: '步行街' },
      { keywords: '滨江步道' }
    ],
    '找个放松的地方': [
      { keywords: '咖啡馆' },
      { keywords: '茶馆' },
      { keywords: '公园' }
    ],
    '雨天去处': [
      { keywords: '商场' },
      { keywords: '书店' },
      { keywords: '咖啡馆' }
    ],
    '建筑漫游': [
      { keywords: '历史建筑' },
      { keywords: '老洋房' },
      { keywords: '文化街区' }
    ]
  };
  
  // 检查是否匹配技能名称
  for (const [skillName, keywords] of Object.entries(skillKeywordMap)) {
    if (intent.includes(skillName.toLowerCase()) || intent === skillName.toLowerCase()) {
      return keywords;
    }
  }
  
  // 咖啡馆相关
  if (intent.includes('咖啡') || intent.includes('coffee') || intent.includes('工作') || intent.includes('久坐')) {
    return [
      { keywords: '咖啡馆' },
      { keywords: '独立咖啡' },
      { keywords: '精品咖啡' }
    ];
  }
  
  // 书店相关
  if (intent.includes('书') || intent.includes('看书') || intent.includes('阅读')) {
    return [
      { keywords: '书店' },
      { keywords: '独立书店' },
      { keywords: '24小时书店' }
    ];
  }
  
  // 安静/放松相关
  if (intent.includes('安静') || intent.includes('放松') || intent.includes('发呆') || intent.includes('chill')) {
    return [
      { keywords: '咖啡馆' },
      { keywords: '茶馆' },
      { keywords: '书店' }
    ];
  }
  
  // 酒吧/夜生活
  if (intent.includes('酒') || intent.includes('bar') || intent.includes('喝') || intent.includes('夜')) {
    return [
      { keywords: '清吧' },
      { keywords: '威士忌吧' },
      { keywords: '鸡尾酒吧' }
    ];
  }
  
  // 公园/户外
  if (intent.includes('公园') || intent.includes('散步') || intent.includes('户外') || intent.includes('走走')) {
    return [
      { keywords: '公园' },
      { keywords: '城市绿地' },
      { keywords: '滨江步道' }
    ];
  }
  
  // 展览/艺术
  if (intent.includes('展') || intent.includes('艺术') || intent.includes('画廊') || intent.includes('博物馆')) {
    return [
      { keywords: '展览馆' },
      { keywords: '美术馆' },
      { keywords: '博物馆' }
    ];
  }
  
  // 默认：综合搜索
  return [
    { keywords: '咖啡馆' },
    { keywords: '书店' },
    { keywords: '茶馆' }
  ];
}

/**
 * 解析 POI 列表
 */
function parsePoiList(pois: any[]): AmapPlace[] {
  return pois.map(poi => {
    const [lng, lat] = (poi.location || '0,0').split(',').map(Number);
    const photos: AmapPhoto[] = (poi.photos || []).map((p: any) => ({
      title: p.title || '',
      url: p.url || ''
    }));

    return {
      id: poi.id || '',
      name: poi.name || '',
      type: poi.type || '',
      typecode: poi.typecode || '',
      address: poi.address || poi.pname + poi.cityname + poi.adname || '',
      location: poi.location || '',
      lat,
      lng,
      distance: poi.distance ? parseInt(poi.distance) : undefined,
      tel: poi.tel || '',
      rating: poi.biz_ext?.rating || '',
      cost: poi.biz_ext?.cost || '',
      opentime: poi.biz_ext?.open_time || '',
      photos,
      biz_ext: poi.biz_ext
    };
  });
}

/**
 * 格式化距离显示
 */
export function formatDistance(meters?: number): string {
  if (!meters) return '';
  if (meters < 1000) {
    return `${meters}米`;
  }
  return `${(meters / 1000).toFixed(1)}公里`;
}

/**
 * 格式化步行时间（假设步行速度 5km/h）
 */
export function formatWalkTime(meters?: number): string {
  if (!meters) return '';
  const minutes = Math.round(meters / 83); // 5km/h ≈ 83m/min
  if (minutes < 1) return '1分钟';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

/**
 * 检查 API Key 是否配置
 */
export function hasAmapKey(): boolean {
  return Boolean(AMAP_API_KEY);
}

/**
 * 获取地点照片 URL（直接返回高德照片 URL）
 */
export function getPhotoUrl(place: AmapPlace): string | null {
  if (place.photos && place.photos.length > 0) {
    return place.photos[0].url;
  }
  return null;
}
