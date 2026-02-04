/**
 * Weather Service - 使用 Open-Meteo API（免费，无需 API Key）
 * 
 * P1 优化：为 Sky 频道提供真实天气数据
 */

export interface WeatherData {
  temperature: number;        // 当前温度（摄氏度）
  weatherCode: number;        // WMO 天气代码
  weatherDescription: string; // 天气描述（中文）
  humidity: number;           // 湿度百分比
  windSpeed: number;          // 风速 km/h
  sunset: string;             // 日落时间 ISO 格式
  sunrise: string;            // 日出时间 ISO 格式
  isDay: boolean;             // 是否白天
}

// WMO 天气代码到中文描述的映射
const WEATHER_CODE_MAP: Record<number, string> = {
  0: '晴朗',
  1: '大部晴朗',
  2: '局部多云',
  3: '多云',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '中毛毛雨',
  55: '大毛毛雨',
  56: '冻毛毛雨',
  57: '冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '小阵雨',
  81: '中阵雨',
  82: '大阵雨',
  85: '小阵雪',
  86: '大阵雪',
  95: '雷暴',
  96: '雷暴伴小冰雹',
  99: '雷暴伴大冰雹'
};

function getWeatherDescription(code: number): string {
  return WEATHER_CODE_MAP[code] || '未知';
}

/**
 * 获取指定坐标的天气数据
 * 默认使用上海坐标
 */
export async function getWeather(lat: number = 31.2304, lng: number = 121.4737): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=sunrise,sunset&timezone=Asia/Shanghai`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const current = data.current;
    const daily = data.daily;
    
    return {
      temperature: Math.round(current.temperature_2m),
      weatherCode: current.weather_code,
      weatherDescription: getWeatherDescription(current.weather_code),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      sunset: daily.sunset[0],
      sunrise: daily.sunrise[0],
      isDay: current.is_day === 1
    };
  } catch (error) {
    console.error('[Weather] Failed to fetch weather data:', error);
    // 返回默认数据
    return getDefaultWeather();
  }
}

/**
 * 获取默认天气数据（当 API 调用失败时使用）
 */
function getDefaultWeather(): WeatherData {
  const now = new Date();
  const hour = now.getHours();
  
  // 计算近似日落时间（上海，根据季节调整）
  const month = now.getMonth();
  let sunsetHour = 17;
  if (month >= 4 && month <= 8) sunsetHour = 19; // 夏季
  else if (month >= 2 && month <= 3) sunsetHour = 18; // 春季
  else if (month >= 9 && month <= 10) sunsetHour = 17; // 秋季
  // 冬季默认 17 点
  
  const sunset = new Date(now);
  sunset.setHours(sunsetHour, Math.floor(Math.random() * 30) + 10, 0);
  
  const sunrise = new Date(now);
  sunrise.setHours(6, Math.floor(Math.random() * 30) + 10, 0);
  
  return {
    temperature: 15,
    weatherCode: 0,
    weatherDescription: '晴朗',
    humidity: 60,
    windSpeed: 10,
    sunset: sunset.toISOString(),
    sunrise: sunrise.toISOString(),
    isDay: hour >= 6 && hour < sunsetHour
  };
}

/**
 * 格式化日落时间为简短格式
 */
export function formatSunsetTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '17:30';
  }
}
