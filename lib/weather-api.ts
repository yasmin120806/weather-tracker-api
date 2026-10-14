import { Platform } from 'react-native';

const defaultApiUrl = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://10.60.2.19:8000',
});

export const WEATHER_API_URL =
  process.env.EXPO_PUBLIC_WEATHER_API_URL ?? defaultApiUrl;

export type ChatMessageItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type CityPhoto = {
  image_url: string | null;
  thumbnail_url: string | null;
  blur_hash?: string | null;
  description?: string | null;
  photographer?: string | null;
  photographer_profile?: string | null;
  note?: string;
};

export type CurrentWeather = {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  uv_index?: number;
  is_day?: number;
  air_quality?: {
    us_aqi?: number;
    pm10?: number;
    pm2_5?: number;
  };
};

export type DailyWeather = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  uv_index_max?: number[];
  sunrise?: string[];
  sunset?: string[];
};

export type HourlyWeather = {
  time:string[];
  temperature_2m: number[];
  precipitation_probability?: number[];
  weather_code: number[];
  cloud_cover: number[];
};

export type WeatherResponse = {
  location: {
    city: string;
    region?: string | null;
    country?: string | null;
    latitude: number;
    longitude: number;
    season?: string;
    photo?: CityPhoto;
  };
  current: CurrentWeather;
  hourly: HourlyWeather;
  seven_day_forecast: DailyWeather;
  units: Record<string, string>;
};

export type FavoriteCity = {
  id?: number;
  name: string;
  admin1?: string | null;
  country?: string | null;
  latitude: string;
  longitude: string;
  timezone?: string;
};

type FavoriteResponse ={
  message?:string;
  city?: FavoriteCity;
  favorites?: FavoriteCity[];
  detail?:string;
};

type ApiError = {
  detail?: string;
};

const weatherCache = new Map<
  string,
  { data: WeatherResponse; expiresAt: number }
>();

const WEATHER_CACHE_MS = 10 * 60 * 1000;//10 minutes

weatherCache.clear();

export async function askChatbot(
  messages: ChatMessageItem[],
  city_context?: Record<string, any>
) : Promise<string> {
  const response = await fetch(`${WEATHER_API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify({ messages, city_context: city_context}),
  });

  if (!response.ok) {
    throw new Error(`Chat error (${response.status})`);
  }

  const data = await response.json();
  return data.reply;
}


export async function getWeather(city: string, forceRefresh = false): Promise<WeatherResponse> {
  const normalizedCity = city.trim().toLowerCase();
  const cached = weatherCache.get(normalizedCity);

  if (!forceRefresh && cached && cached.expiresAt > Date.now() && cached.data.location.photo?.image_url) {
    return cached.data;
  }

  const response = await fetch(
    `${WEATHER_API_URL}/weather/${encodeURIComponent(city.trim())}`
  );

  if (!response.ok) {
    let message = `Weather request failed (${response.status})`;

    try {
      const body = (await response.json()) as ApiError;
      message = body.detail ?? message;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }

    throw new Error(message);
  }

  const data = (await response.json()) as WeatherResponse;

  weatherCache.set(normalizedCity, {
    data,
    expiresAt: Date.now() + WEATHER_CACHE_MS,
  });

  return data;
}

export async function saveFavorite(city: string): Promise<string> {
  const response = await fetch (`${WEATHER_API_URL}/favorites/${encodeURIComponent(city.trim())}`, {
    method: 'POST',
  });
  const body = (await response.json()) as FavoriteResponse;

  if (!response.ok) {
    throw new Error(body.detail ?? `Failed to save favorite city (${response.status})`);
  }

  return body.message ?? `City "${city}" saved as favorite successfully.`;
}

export async function getFavorites(): Promise<FavoriteCity[]> {
  const response = await fetch(`${WEATHER_API_URL}/favorites`);
  const body = (await response.json()) as FavoriteResponse;

  if (!response.ok) {
    throw new Error(body.detail ?? `Failed to fetch favorite cities (${response.status})`);
  }

  return body.favorites ?? [];
}
