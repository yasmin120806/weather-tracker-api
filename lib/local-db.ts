import * as SQLite from 'expo-sqlite';
import type { WeatherResponse } from './weather-api';

const db = SQLite.openDatabaseSync('local_weather.db');

export function initLocalDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS city_weather_cache (
      city TEXT PRIMARY KEY COLLATE NOCASE,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export function saveCachedCityWeather(city: string, data: WeatherResponse): void {
  try {
    const jsonStr = JSON.stringify(data);
    db.runSync(
      `INSERT OR REPLACE INTO city_weather_cache (city, data, updated_at) VALUES (?, ?, ?);`,
      [city.trim().toLowerCase(), jsonStr, Date.now()]
    );
  } catch (err) {
    console.warn('SQLite write failure:', err);
  }
}

export function getCachedCityWeather(city: string): WeatherResponse | null {
  try {
    const row = db.getFirstSync<{ data: string; updated_at: number }>(
      `SELECT data, updated_at FROM city_weather_cache WHERE city = ?;`,
      [city.trim().toLowerCase()]
    );
    if (!row) return null;
    return JSON.parse(row.data) as WeatherResponse;
  } catch (err) {
    console.warn('SQLite read failure:', err);
    return null;
  }
}