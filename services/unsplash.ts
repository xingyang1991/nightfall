/**
 * Unsplash Image Service
 * 根据地点类型和关键词搜索高质量图片
 */

const UNSPLASH_API_BASE = 'https://api.unsplash.com';

// 地点类型到搜索关键词的映射
const PLACE_TYPE_KEYWORDS: Record<string, string[]> = {
  // 咖啡馆类
  'coffee': ['coffee shop interior', 'cafe cozy', 'coffee house aesthetic'],
  'cafe': ['cafe interior design', 'coffee shop cozy', 'cafe atmosphere'],
  '咖啡': ['coffee shop interior', 'cafe cozy shanghai', 'coffee aesthetic'],
  '咖啡馆': ['coffee shop interior', 'cafe cozy', 'coffee house warm'],
  
  // 书店/阅读类
  'bookstore': ['bookstore interior', 'library cozy', 'reading room'],
  'book': ['bookstore aesthetic', 'library warm', 'reading corner'],
  '书店': ['bookstore interior', 'library aesthetic', 'reading space'],
  '书房': ['reading room cozy', 'study room', 'library interior'],
  '阅读': ['reading corner', 'bookstore cozy', 'library warm light'],
  
  // 酒店大堂类
  'hotel': ['hotel lobby luxury', 'hotel lounge', 'hotel interior'],
  'lobby': ['hotel lobby design', 'lobby lounge', 'hotel reception'],
  '酒店': ['hotel lobby shanghai', 'hotel lounge luxury', 'hotel interior'],
  '大堂': ['hotel lobby', 'lobby interior', 'hotel reception area'],
  
  // 公园/户外类
  'park': ['park bench night', 'city park evening', 'park pathway'],
  '公园': ['park shanghai', 'city park night', 'park bench evening'],
  '江边': ['riverside night', 'waterfront evening', 'river walk'],
  '外滩': ['shanghai bund night', 'bund riverside', 'shanghai waterfront'],
  
  // 茶馆类
  'tea': ['tea house interior', 'tea room aesthetic', 'chinese tea house'],
  '茶': ['tea house chinese', 'tea room cozy', 'tea ceremony space'],
  '茶馆': ['chinese tea house', 'tea room interior', 'tea house warm'],
  
  // 联合办公/工作空间
  'coworking': ['coworking space', 'shared office', 'workspace modern'],
  'workspace': ['workspace design', 'office interior', 'work desk'],
  '办公': ['coworking space', 'office interior modern', 'workspace'],
  '工作': ['workspace cozy', 'work desk setup', 'office aesthetic'],
  
  // 酒吧类
  'bar': ['bar interior', 'cocktail bar', 'bar lounge'],
  '酒吧': ['bar interior shanghai', 'cocktail bar cozy', 'bar lounge'],
  
  // 餐厅类
  'restaurant': ['restaurant interior', 'dining room', 'restaurant cozy'],
  '餐厅': ['restaurant interior', 'dining aesthetic', 'restaurant shanghai'],
  
  // 默认/通用
  'default': ['urban night', 'city evening', 'cozy interior', 'shanghai night'],
};

// 图片缓存（避免重复请求）
const imageCache = new Map<string, { url: string; photographer: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1小时缓存

/**
 * 从标题中提取地点类型关键词
 */
function extractPlaceType(title: string): string {
  const normalizedTitle = title.toLowerCase();
  
  // 按优先级检查关键词
  const priorities = [
    '咖啡馆', '咖啡', 'coffee', 'cafe',
    '书店', '书房', '阅读', 'bookstore', 'book',
    '酒店', '大堂', 'hotel', 'lobby',
    '茶馆', '茶', 'tea',
    '公园', '江边', '外滩', 'park',
    '办公', '工作', 'coworking', 'workspace',
    '酒吧', 'bar',
    '餐厅', 'restaurant',
  ];
  
  for (const keyword of priorities) {
    if (normalizedTitle.includes(keyword)) {
      return keyword;
    }
  }
  
  return 'default';
}

/**
 * 搜索 Unsplash 图片
 */
export async function searchUnsplashImage(
  query: string,
  options: { orientation?: 'landscape' | 'portrait' | 'squarish'; perPage?: number } = {}
): Promise<{ url: string; photographer: string; photographerUrl: string } | null> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) {
    console.warn('[Unsplash] Missing UNSPLASH_ACCESS_KEY');
    return null;
  }

  // 检查缓存
  const cacheKey = `${query}_${options.orientation || 'any'}`;
  const cached = imageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { url: cached.url, photographer: cached.photographer, photographerUrl: '' };
  }

  const orientation = options.orientation || 'squarish';
  const perPage = options.perPage || 10;
  
  // 随机选择一个结果以增加多样性
  const randomPage = Math.floor(Math.random() * 3) + 1;

  const url = `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&page=${randomPage}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) {
      console.error(`[Unsplash] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.warn(`[Unsplash] No results for query: ${query}`);
      return null;
    }

    // 随机选择一张图片
    const randomIndex = Math.floor(Math.random() * Math.min(data.results.length, 5));
    const photo = data.results[randomIndex];

    const result = {
      url: photo.urls.regular, // 1080px 宽度，适合大多数场景
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
    };

    // 更新缓存
    imageCache.set(cacheKey, {
      url: result.url,
      photographer: result.photographer,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error('[Unsplash] Fetch error:', error);
    return null;
  }
}

/**
 * 根据地点标题获取匹配的图片
 */
export async function getImageForPlace(title: string): Promise<string | null> {
  const placeType = extractPlaceType(title);
  const keywords = PLACE_TYPE_KEYWORDS[placeType] || PLACE_TYPE_KEYWORDS['default'];
  
  // 随机选择一个关键词
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  
  console.log(`[Unsplash] Searching for "${title}" with keyword: "${randomKeyword}"`);
  
  const result = await searchUnsplashImage(randomKeyword, { orientation: 'squarish' });
  
  return result?.url || null;
}

/**
 * 批量获取候选地点的图片
 */
export async function getImagesForCandidates(
  candidates: Array<{ id: string; title: string; image_ref?: string }>
): Promise<Array<{ id: string; title: string; image_ref: string }>> {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      // 如果已有有效的图片引用，跳过
      if (candidate.image_ref && candidate.image_ref.startsWith('http')) {
        return candidate as { id: string; title: string; image_ref: string };
      }
      
      const imageUrl = await getImageForPlace(candidate.title);
      return {
        ...candidate,
        image_ref: imageUrl || `nf://cover/${candidate.id}`, // fallback 到程序生成
      };
    })
  );
  
  return results;
}

/**
 * 获取票据封面图片
 */
export async function getCoverImage(title: string, fallbackSeed: string): Promise<string> {
  const imageUrl = await getImageForPlace(title);
  return imageUrl || `nf://cover/${fallbackSeed}`;
}
