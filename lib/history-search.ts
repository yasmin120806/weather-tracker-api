import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_STORAGE_KEY = '@weather_search_history';

export interface HistoryItem {
  city: string;
  country: string;
  searchedAt: string;
}

export async function getSearchHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to load history:', err);
    return [];
  }
}

export async function saveSearchItem(city: string, country: string = ''): Promise<void> {
  try {
    const current = await getSearchHistory();
    const newItem: HistoryItem = {
      city: city.trim(),
      country: country.trim(),
      searchedAt: 'Just now',
    };

    // Remove duplicates (case-insensitive) and prepend new search (keep top 10)
    const filtered = current.filter(
      (item) => item.city.toLowerCase() !== newItem.city.toLowerCase()
    );
    const updated = [newItem, ...filtered].slice(0, 10);

    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save search:', err);
  }
}

export async function clearAllSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear search history:', err);
  }
}