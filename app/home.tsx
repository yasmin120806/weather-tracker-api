import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Wind, Navigation, ChevronRight, Clock } from 'lucide-react-native';
import { StyleSheet, Image, View } from 'react-native';
import { saveSearchItem } from '@/lib/history-search';

import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { SearchIcon } from '@/components/ui/icon';

import { getWeather, type WeatherResponse } from '@/lib/weather-api';
import { Button, ButtonIcon, ButtonSpinner } from '@/components/ui/button';
import { getCachedCityWeather, initLocalDatabase, saveCachedCityWeather } from '@/lib/local-db';

type SeasonTab = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

interface DestinationItem {
  city: string;
  country: string;
  tag: string;
}

const SEASON_DESTINATIONS: Record<SeasonTab, DestinationItem[]> = {
  Spring: [
    { city: 'Kyoto', country: 'Japan', tag: 'Cherry Blossoms' },
    { city: 'Amsterdam', country: 'Netherlands', tag: 'Tulip Fields' },
    { city: 'Paris', country: 'France', tag: 'Spring Bloom' },
    { city: 'Vancouver', country: 'Canada', tag: 'Mild & Green' },
  ],
  Summer: [
    { city: 'Santorini', country: 'Greece', tag: 'Sun & Coast' },
    { city: 'Barcelona', country: 'Spain', tag: 'Beach City' },
    { city: 'Dubai', country: 'United Arab Emirates', tag: 'Desert Sun' },
    { city: 'Sydney', country: 'Australia', tag: 'Coastal Warmth' },
  ],
  Autumn: [
    { city: 'Seoul', country: 'South Korea', tag: 'Foliage' },
    { city: 'Munich', country: 'Germany', tag: 'Golden Autumn' },
    { city: 'New York', country: 'United States', tag: 'Central Park Colors' },
    { city: 'London', country: 'United Kingdom', tag: 'Crisp & Foggy' },
  ],
  Winter: [
    { city: 'Sapporo', country: 'Japan', tag: 'Snow Paradise' },
    { city: 'Zurich', country: 'Switzerland', tag: 'Alpine Slopes' },
    { city: 'Reykjavik', country: 'Iceland', tag: 'Northern Lights' },
    { city: 'Oslo', country: 'Norway', tag: 'Winter Wonderland' },
  ],
};

const SEASONS: SeasonTab[] = ['Spring', 'Summer', 'Autumn', 'Winter'];

type Condition = {
  icon: string;
  label: string;
};

type HourlyItem = Condition & {
  index: number;
  time: string;
  temperature: number;
  windSpeed: number;
};

function getCondition(code?: number | null): Condition {
  if (code == null) return { icon: '🌤️', label: 'Cloudy' };
  if (code === 0) return { icon: '☀️', label: 'Clear' };
  if (code <= 3) return { icon: '🌤️', label: 'Partly cloudy' };
  if (code <= 48) return { icon: '☁️', label: 'Cloudy' };
  if (code <= 67) return { icon: '🌧️', label: 'Rain' };
  if (code <= 77) return { icon: '🌨️', label: 'Snow' };
  if (code <= 82) return { icon: '🌧️', label: 'Rain showers' };
  return { icon: '⛈️', label: 'Thunderstorms' };
}

function getGreeting(d: Date = new Date()): string {
  const hour = d.getHours();
  if (hour < 12) return 'Good morning ☀️';
  if (hour < 18) return 'Good afternoon 🌤️';
  return 'Good evening 🌙';
}

function formatCardDate(date: Date = new Date()) {
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return { dayName, dateStr: `${day}.${month}.${year}` };
}

function getThemeStyles(weatherCode: number = 0, hour: number = 12) {
  const isNight = hour < 6 || hour >= 19;

  // 1. Night Mode (6 AM to 7 PM is Day, outside is Night)
  if (isNight) {
    return {
      bg: '#050814',            // Deep midnight
      cardBg: '#0f172a',        // Dark slate card
      accent: '#818cf8',
      pillActive: 'bg-indigo-500/30 border-indigo-400',
      textColor: 'text-white',
      subTextColor: 'text-slate-400',
    };
  }

  // 2. Day Rain / Overcast Mode (Keep bright sky-tinted slate, not dark black)
  if (weatherCode >= 51) {
    return {
      bg: '#e2e8f0',            // Soft slate-gray daylight
      cardBg: '#0284c7',        // Sky blue card
      accent: '#0284c7',
      pillActive: 'bg-white/20 border-white/40',
      textColor: 'text-slate-900',
      subTextColor: 'text-slate-600',
    };
  }

  // 3. Clear / Partly Cloudy Daytime
  return {
    bg: '#bae6fd',              // Light sky blue
    cardBg: '#0284c7',          // Vibrant ocean blue card
    accent: '#38bdf8',
    pillActive: 'bg-white/25 border-white/40',
    textColor: 'text-sky-950',
    subTextColor: 'text-sky-800',
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [city, setCity] = useState('Kuala Lumpur');
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedSeason, setSelectedSeason] = useState<SeasonTab>('Spring');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherResponse>>({});
  const [loadingCities, setLoadingCities] = useState<Record<string, boolean>>({});

  const isMountedRef = useRef(false);
  const weatherRequestRef = useRef(0);

  const currentList = SEASON_DESTINATIONS[selectedSeason];

  useEffect(() => {
    initLocalDatabase();
    const offlineCached = getCachedCityWeather('Kuala Lumpur');
    if (offlineCached) {
      setWeather(offlineCached);
      setIsLoading(false);
    }
    void loadWeather('Kuala Lumpur');
  }, []);

  // Fetch seasonal destinations
  useEffect(() => {
    let isMounted = true;

    async function loadSeasonalCities() {
      // Filter out cities already loaded into state
      const citiesToFetch = currentList.filter((item) => !weatherData[item.city]);
      if (citiesToFetch.length === 0) return;

      // Mark cities as loading
      setLoadingCities((prev) => {
        const next = { ...prev };
        citiesToFetch.forEach((c) => {
          next[c.city] = true;
        });
        return next;
      });

      const results = await Promise.allSettled(
        citiesToFetch.map(async (item) => {
          const cached = getCachedCityWeather(item.city);
          if (cached) return { city: item.city, data: cached };
          const data = await getWeather(item.city);
          saveCachedCityWeather(item.city, data);
          return { city: item.city, data };
        })
      );

      if (!isMounted) return;

      setWeatherData((prev) => {
        const next = { ...prev };
        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value.data) {
            next[res.value.city] = res.value.data;
          } else if (res.status === 'rejected') {
            console.warn('[Seasonal Weather Error]', res.reason);
          }
        });
        return next;
      });

      setLoadingCities((prev) => {
        const next = { ...prev };
        citiesToFetch.forEach((c) => {
          next[c.city] = false;
        });
        return next;
      });
    }

    void loadSeasonalCities();

    return () => {
      isMounted = false;
    };
  }, [selectedSeason]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function handleSearch(targetCity?: string) {
    const cityToLoad = (targetCity ?? searchQuery).trim();
    if (!cityToLoad) return;
    setSearchQuery('');
    setCity(cityToLoad);
    await loadWeather(cityToLoad);
  }

  async function loadWeather(cityName = city) {
    const requestId = ++weatherRequestRef.current;
    if (!cityName.trim()) return;

    setIsLoading(true);

    try {
      const result = await getWeather(cityName);
      if (!isMountedRef.current || requestId !== weatherRequestRef.current) return;
      setWeather(result);
      setSelectedHourIndex(0);
      void saveSearchItem(result.location.city, result.location.country ?? '');
      saveCachedCityWeather(cityName, result);
    } catch (e) {
      console.warn('Current location weather fetch failed', e);
    } finally {
      if (isMountedRef.current && requestId === weatherRequestRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    void loadWeather('Kuala Lumpur');
    return () => {
      isMountedRef.current = false;
    };
  }, []);


  // Compute 5 hourly items
  const hourlyWeather = useMemo<HourlyItem[]>(() => {
    if (!weather?.hourly?.time || weather.hourly.time.length === 0) return [];

    const nowHour = clock.getHours();
    const formattedHour = String(nowHour).padStart(2, '0');
    const todayIso = `${clock.getFullYear()}-${String(clock.getMonth() + 1).padStart(2, '0')}-${String(clock.getDate()).padStart(2, '0')}`;
    const targetPrefix = `${todayIso}T${formattedHour}`;

    let startIndex = weather.hourly.time.findIndex((t) => t.startsWith(targetPrefix));

    if (startIndex === -1) {
      const nowMs = clock.getTime();
      startIndex = weather.hourly.time.findIndex(
        (t) => new Date(t).getTime() >= nowMs - 50 * 60 * 1000
      );
    }
    if (startIndex === -1) startIndex = 0;

    return weather.hourly.time.slice(startIndex, startIndex + 5).map((timeStr, idx) => {
      const apiIdx = startIndex + idx;
      const isNow = idx === 0;
      const code = isNow ? weather.current.weather_code : weather.hourly.weather_code?.[apiIdx];
      const cond = getCondition(code);
      const temperature = isNow
        ? Math.round(weather.current.temperature_2m)
        : Math.round(weather.hourly.temperature_2m[apiIdx]);
      const windSpeed = isNow
        ? (weather.current.wind_speed_10m ?? 2.9)
        : ((weather.hourly as any)?.wind_speed_10m?.[apiIdx] ?? 2.9);

      const hourNum = parseInt(timeStr.split('T')[1]?.split(':')[0] ?? '0', 10);
      const isPm = hourNum >= 12;
      const formattedHour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
      const formattedTime = `${formattedHour12} ${isPm ? 'PM' : 'AM'}`;

      return {
        ...cond,
        index: idx,
        time: idx === 0 ? 'Now' : formattedTime,
        temperature,
        windSpeed,
      };
    });
  }, [weather, clock]);

  const currentCondition = getCondition(weather?.current?.weather_code ?? 0);
  const currentTemp = Math.round(weather?.current?.temperature_2m ?? 27);
  const theme = getThemeStyles(weather?.current?.weather_code ?? 0, clock.getHours());

  const activeDisplay =
    selectedHourIndex === 0 || !hourlyWeather[selectedHourIndex]
      ? {
          icon: currentCondition.icon,
          label: currentCondition.label,
          temperature: currentTemp,
          windSpeed: weather?.current?.wind_speed_10m ?? 9.2,
        }
      : {
          icon: hourlyWeather[selectedHourIndex].icon,
          label: hourlyWeather[selectedHourIndex].label,
          temperature: hourlyWeather[selectedHourIndex].temperature,
          windSpeed: hourlyWeather[selectedHourIndex].windSpeed,
        };

  const cardDate = formatCardDate(clock);
  const greetingText = getGreeting(clock);


  return (
    <View style={{ flex: 1, backgroundColor: theme.bg}}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <VStack space="lg" className="p-4">
            <HStack className='w-full justify-between items-center'>
            <VStack space="xs">
              <Text className="text-sm font-medium text-blue-800">
                {greetingText}
              </Text>
              <Heading size="2xl" bold style={{ color: theme.textColor === 'text-blue-900' ? '#fff' : undefined}} className={theme.textColor}>
                {weather?.location?.city ?? city}
              </Heading>
              <Text className={`text-xs ${theme.subTextColor}`}>
                Currently in {weather?.location?.country ?? 'Malaysia'}
              </Text>
            </VStack> 
            <HStack space='xs' className='items-center'>
              <Button
                onPress={() => router.push('/favorites')}
                className="h-11 w-11 p-0 items-center justify-center rounded-2xl border bg-blue-50 border-blue-400"
              >
                <Text className="text-xl leading-none">💙</Text>
              </Button>
              <Button
                onPress={() => router.push('/world')}
                className="h-11 w-11 p-0 items-center justify-center rounded-2xl border bg-blue-50 border-blue-400"
              >
                <Text className="text-xl leading-none">🌏</Text>
              </Button>
              <Button
                onPress={() => router.push('/history')}
                className="h-11 w-11 p-0 items-center justify-center rounded-2xl border bg-blue-50 border-blue-400"
              >
                <Clock size={20} color="#0369a1" />
              </Button>
              </HStack>
            </HStack>

            <HStack space="sm" className="items-center mt-2">
              <Input style={{
                backgroundColor: '#ffffff',
                borderColor: '#60a5fa',
                borderRadius: 16,
                overflow: 'hidden',
                height: 48,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 0,
              }}
              className="flex-1 shadow-sm">
                <InputSlot className="pl-3 bg-transparent">
                  <InputIcon as={SearchIcon} className="text-slate-500" />
                </InputSlot>
                <InputField
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => handleSearch()}
                  placeholder="Search city, e.g. London"
                  placeholderTextColor="#64748b"
                  returnKeyType="search"
                  className="flex-1 text-slate-900 text-sm bg-transparent border-0 px-2"
                />
              </Input>

              <Button
                size="icon"
                className="h-12 w-12 rounded-2xl border bg-blue-50 border-blue-400 shadow-sm"
                onPress= {() => {router.push({
                  pathname: '/location/[city]',
                  params: {
                  city: searchQuery.trim(),
                  },
                })
              }}
                isDisabled={isLoading || !searchQuery.trim()}
              >
                {isLoading ? (
                  <ButtonSpinner className="text-sky-700" />
                ) : (
                  <ButtonIcon as={SearchIcon} className="text-sky-700" />
                )}
              </Button>

            </HStack>

            {/* ---------------- MAIN CARD -------------------- */}
            <Pressable
              onPress={() => loadWeather(weather?.location?.city ?? city)}
              accessibilityRole="button"
              accessibilityLabel="Current weather card, tap to refresh"
              className="w-full active:scale-[0.99]"
            >
              <Box className="w-full rounded-3xl p-5 border border-teal-500/20 bg-sky-600 shadow-2xl">
                <HStack className="justify-between items-center mb-3">
                  <HStack space="xs" className="items-center">
                    <Text className="text-base font-semibold text-white/95 ml-1">
                      {activeDisplay.label}
                    </Text>
                  </HStack>
                  <Text className="text-base font-bold text-white tracking-wide">
                    {weather?.location?.city ?? city}
                  </Text>
                </HStack>

                <HStack className="items-center justify-between">
                  <VStack space="xs" className="w-[34%] justify-between">
                    <HStack className="items-start">
                      <Text className="text-6xl bold text-white leading-none">
                        {activeDisplay.temperature}
                      </Text>
                      <Text className="text-xl font-light text-white mt-1">°</Text>
                    </HStack>

                    <VStack className="mt-1">
                      <Text className="text-md font-medium text-sky-50">
                        {cardDate.dayName}
                      </Text>
                      <Text className="text-s text-sky-50/70">
                        {cardDate.dateStr}
                      </Text>
                    </VStack>

                    <HStack space="xs" className="items-center mt-3">
                      <Wind size={18} color="#ecfeff" />
                      <Text className="text-md font-semibold text-sky-50">
                        {activeDisplay.windSpeed}
                      </Text>
                    </HStack>
                  </VStack>

                  <HStack space="xs" className="flex-1 justify-between items-center pl-2">
                    {isLoading && !weather ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <Skeleton
                          key={idx}
                          className="h-32 w-11 rounded-2xl bg-teal-50/40"
                        />
                      ))
                    ) : (
                      hourlyWeather.map((hour) => {
                        const isSelected = hour.index === selectedHourIndex;
                        return (
                          <Pressable
                            key={hour.time}
                            onPress={() => setSelectedHourIndex(hour.index)}
                            className={`items-center py-2 px-2.5 rounded-2xl ${
                              isSelected
                                ? 'bg-cyan-100/35 border border-indigo-50/40'
                                : 'bg-transparent border border-transparent'
                            }`}
                          >
                            <Text
                              className={`text-[11px] mb-2 font-medium ${
                                isSelected ? 'text-white font-bold' : 'text-teal-100/70'
                              }`}
                            >
                              {hour.time}
                            </Text>

                            <Text className="text-xl mb-2">{hour.icon}</Text>

                            <Text className="text-xs font-semibold text-white mb-2">
                              {hour.temperature}°
                            </Text>

                            <Navigation
                              size={11}
                              color={isSelected ? '#ecfeff' : '#cffafe'}
                              style={{ transform: [{ rotate: '45deg' }] }}
                            />

                            <Text className="text-[10px] font-medium text-white/90 mt-1">
                              {hour.windSpeed}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </HStack>
                </HStack>
              </Box>
            </Pressable>

            {/* ------------------------- SEASONAL DESTINATIONS ---------------------- */}
            <VStack space="xs" className="mt-2">
              <Heading size="2xl" bold className="text-blue-900">
                Seasonal Location
              </Heading>
              <Text className="text-sm text-blue-800-muted">
                Explore popular world destinations suited for each season.
              </Text>
            </VStack>

            {/* Season Selector Tabs */}
            <HStack space="sm" className="mt-1">
              {SEASONS.map((season) => {
                const isActive = selectedSeason === season;
                return (
                  <Pressable
                    key={season}
                    onPress={() => setSelectedSeason(season)}
                    className={`flex-1 items-center justify-center py-2.5 rounded-2xl border ${
                      isActive
                        ? 'bg-blue-300 border-blue-400 shadow-md'
                        : 'bg-blue-50 border-blue-400'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isActive ? 'text-slate-950' : 'text-sky-600'
                      }`}
                    >
                      {season}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>

            {/* Location Cards */}
            <VStack space="md" className="mt-2">
              {currentList.map((item) => {
                const itemWeather = weatherData[item.city];
                const itemLoading = loadingCities[item.city] ?? !itemWeather;
                const photoUrl =
                  itemWeather?.location?.photo?.image_url ??
                  itemWeather?.location?.photo?.thumbnail_url ??
                  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';

                const temp = itemWeather
                  ? Math.round(itemWeather.current.temperature_2m)
                  : null;
                const tempUnit = itemWeather?.units?.temperature_2m_max ?? '°C';

                return (
                  <Pressable
                    key={item.city}
                    onPress={() => {
                      router.push({
                        pathname: '/location/[city]' as any,
                        params: { city: item.city, country: item.country, photoUrl: photoUrl },
                      });
                    }}
                    className="active:scale-[0.98] transition-transform"
                  >
                    <View
                      style={{
                        height: 176,
                        width: '100%',
                        borderRadius: 24,
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundColor: '#1e293b',
                      }}
                    >
                      {/* 1. Background Photo */}
                      <Image
                        source={{ uri: photoUrl }}
                        resizeMode="cover"
                        style={StyleSheet.absoluteFillObject}
                        onLoadStart={() => console.log(`📸 [Card Image] Loading: ${item.city}`)}
                        onLoad={() => console.log(`✅ [Card Image] Rendered: ${item.city}`)}
                        onError={(e) => console.log(`❌ [Card Image] Failed: ${item.city}`, e.nativeEvent.error)}
                      />

                      {/* 2. Legibility Overlay */}
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFillObject,
                          { backgroundColor: 'rgba(15, 23, 42, 0.45)' },
                        ]}
                      />

                      {/* 3. Card Content */}
                      <Box className="w-full h-full justify-between p-4">
                        <HStack className="items-start justify-between">
                          <VStack space="xs">
                            <Heading size="lg" className="text-white font-bold">
                              {item.city}
                            </Heading>
                            <Text className="text-xs text-slate-300 font-medium">
                              {item.country}
                            </Text>
                          </VStack>
                          <Text className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            {item.tag}
                          </Text>
                        </HStack>

                        <HStack className="items-end justify-between">
                          {itemLoading ? (
                            <Skeleton className="h-8 w-24 rounded-xl bg-white/20" />
                          ) : itemWeather ? (
                            <VStack>
                              <Text size="3xl" bold className="text-white leading-none">
                                {temp}
                              </Text>
                              <Text size="lg" className="text-white font-normal">
                                {tempUnit}
                              </Text>
                              <Text className="text-[11px] text-slate-200 mt-1">
                                Wind: {itemWeather.current.wind_speed_10m} km/h
                              </Text>
                            </VStack>
                          ) : (
                            <Text className="text-xs text-slate-300">Tap to load</Text>
                          )}

                          <HStack
                            space="xs"
                            className="items-center bg-blue-50/20 border-blue-400 px-2.5 py-1 rounded-xl border "
                          >
                            <Text className="text-xs text-sky-600 font-medium">
                              Details
                            </Text>
                            <ChevronRight size={14} color="#d3d6f9" />
                          </HStack>
                        </HStack>
                      </Box>
                    </View>
                  </Pressable>
                );
              })}
            </VStack>

            {/* "See More" Button */}
            <Pressable
              onPress={() => {
                router.push({
                  pathname: '/season/[season]' as any,
                  params: { season: selectedSeason.toLowerCase() },
                });
              }}
              className="mt-2 items-center justify-center rounded-2xl border border-teal-500/30 bg-teal-950/20 py-3.5 px-4 active:bg-teal-900/30"
            >
              <HStack space="xs" className="items-center">
                <Text className="text-sm font-semibold text-teal-400">
                  See all {selectedSeason} destinations
                </Text>
                <ChevronRight size={16} color="#2DD4BF" />
              </HStack>
            </Pressable>
          </VStack>
        </ScrollView>
      </SafeAreaView>
      {/* Floating Chat Overlay Button */}
      <Pressable
        onPress={() => router.push('/chat' as any)}
        accessibilityRole="button"
        accessibilityLabel="Open weather chat assistant"
        className="active:opacity-80 transition-transform"
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: 30, // Perfectly circular
          overflow: 'hidden', // Clips the image to the circle
          borderWidth: 2,
          borderColor: '#2d34e7', // Teal border accent
          zIndex: 50,
          elevation: 8, // Android shadow/layering
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          backgroundColor: '#0F172A',
        }}
      >
        <Image
          source={require('@/assets/images/earth-ai.jpg')}
          alt="Earth"
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </Pressable>
    </View>
  );
}