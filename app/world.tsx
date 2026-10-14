import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { ArrowLeftIcon } from '@/components/ui/icon';
import { ScrollView } from '@/components/ui/scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { getWeather, type WeatherResponse } from '@/lib/weather-api';

export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'Tropical';

type LocationWeather = {
  country: string;
  city: string;
  timezone: string;
  latitude: number;
  weather?: WeatherResponse;
  error?: string;
};

// Seasonal fallback colors ensure cards NEVER show up pitch black
const SEASON_BG_COLORS: Record<Season, string> = {
  Tropical: '#134e4a', // Deep Emerald / Jungle
  Spring: '#701a75',   // Cherry Blossom Plum
  Summer: '#1e3a8a',   // Ocean Blue
  Autumn: '#451a03',   // Amber / Foliage Brown
  Winter: '#1e293b',   // Cool Slate
};

// Map your local video files
const SEASON_VIDEOS: Record<Season, any> = {
  Tropical: require('@/assets/videos/summer.mp4'),
  Spring: require('@/assets/videos/spring.mp4'),
  Summer: require('@/assets/videos/summer.mp4'),
  Autumn: require('@/assets/videos/autumn.mp4'),
  Winter: require('@/assets/videos/winter.mp4'),
};

const STATIC_LOCATIONS = [
  {
    country: 'Malaysia',
    city: 'Kuala Lumpur',
    timezone: 'Asia/Kuala_Lumpur',
    latitude: 3.14, // Equatorial -> Tropical
  },
  {
    country: 'South Korea',
    city: 'Seoul',
    timezone: 'Asia/Seoul',
    latitude: 37.56,
  },
  {
    country: 'United Kingdom',
    city: 'London',
    timezone: 'Europe/London',
    latitude: 51.5,
  },
  {
    country: 'United States',
    city: 'New York',
    timezone: 'America/New_York',
    latitude: 40.71,
  },
  {
    country: 'Australia',
    city: 'Sydney',
    timezone: 'Australia/Sydney',
    latitude: -33.86, // Southern Hemisphere -> Spring in October
  },
 
] as const;


function getSeasonForLatitude(lat: number): Season {
  // Equatorial zone (within ±10° latitude) has no temperate 4 seasons
  if (lat >= -10 && lat <= 10) {
    return 'Tropical';
  }

  const month = new Date().getMonth(); // 0 = Jan, 9 = Oct
  const isNorthern = lat > 10;

  let season: Season = 'Winter';
  if (month >= 2 && month <= 4) season = 'Spring';
  else if (month >= 5 && month <= 7) season = 'Summer';
  else if (month >= 8 && month <= 10) season = 'Autumn';

  if (!isNorthern) {
    const opposites: Record<Season, Season> = {
      Spring: 'Autumn',
      Summer: 'Winter',
      Autumn: 'Spring',
      Winter: 'Summer',
      Tropical: 'Tropical',
    };
    return opposites[season];
  }

  return season;
}

function getLocalTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function WeatherVideoCard({
  country,
  city,
  latitude,
  timeString,
  weather,
  error,
}: {
  country: string;
  city: string;
  latitude: number;
  timeString: string;
  weather?: WeatherResponse;
  error?: string;
}) {
  const resolvedSeason: Season = getSeasonForLatitude(latitude);
  const videoSource = SEASON_VIDEOS[resolvedSeason];
  const fallbackBg = SEASON_BG_COLORS[resolvedSeason];

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const temp = weather ? Math.round(weather.current.temperature_2m) : null;
  const tempUnit = weather?.units?.temperature_2m_max ?? '°C';

  return (
    <Card
      className="relative overflow-hidden rounded-3xl border border-white/20 p-0 shadow-lg"
      style={{ 
        height: 213,
        backgroundColor: fallbackBg }}
    >
      {/* 1. Video Layer */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />

      {/* 2. Dark Overlay for Contrast & Text Readability */}
      <Box className="p-5 bg-black/45">
        <HStack className="items-start justify-between">
          <VStack space="xs">
            <HStack space="xs" className="items-center">
              <Heading size="lg" className="text-white">
                {country}
              </Heading>
              <Text className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold text-white">
                {resolvedSeason}
              </Text>
            </HStack>
            <Text className="text-slate-200">{city}</Text>
          </VStack>
          <Text bold className="text-white">
            {timeString}
          </Text>
        </HStack>

        {weather ? (
          <HStack className="mt-5 items-end justify-between">
            <Text size="4xl" bold className="text-white leading-none">
              {temp}
              <Text size="2xl" className="text-white font-normal">
                {tempUnit}
              </Text>
            </Text>
            <VStack className="items-end">
              <Text className="text-slate-200 text-xs">
                Humidity: {weather.current.relative_humidity_2m}%
              </Text>
              <Text className="text-slate-200 text-xs">
                Wind: {weather.current.wind_speed_10m} km/h
              </Text>
            </VStack>
          </HStack>
        ) : error ? (
          <Text className="mt-4 text-rose-400 font-medium">{error}</Text>
        ) : (
          <HStack className="mt-5 items-end justify-between">
            <Skeleton className="h-12 w-24 rounded-xl bg-white/20" />
            <VStack space="sm" className="items-end">
              <Skeleton className="h-4 w-28 rounded-lg bg-white/20" />
              <Skeleton className="h-4 w-24 rounded-lg bg-white/20" />
            </VStack>
          </HStack>
        )}
      </Box>
    </Card>
  );
}


export default function WorldWeatherScreen() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationWeather[]>(() =>
    STATIC_LOCATIONS.map((loc) => ({ ...loc }))
  );
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    async function loadLocations() {
      await Promise.all(
        STATIC_LOCATIONS.map(async (location) => {
          try {
            const weather = await getWeather(location.city);
            setLocations((current) =>
              current.map((item) =>
                item.city === location.city
                  ? { ...item, weather, error: undefined }
                  : item
              )
            );
          } catch (error) {
            setLocations((current) =>
              current.map((item) =>
                item.city === location.city
                  ? {
                      ...item,
                      error:
                        error instanceof Error
                          ? error.message
                          : 'Weather unavailable',
                    }
                  : item
              )
            );
          }
        })
      );
    }
    void loadLocations();

    const clockTimer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(clockTimer);
  }, []);

  return (
    <Box className="flex-1 bg-weather-sky">
      {/* SafeAreaView guarantees the status bar and notch will not clip your content */}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <VStack space="md" className="p-4 pt-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.replace('/home')}
              accessibilityLabel="Back to home"
              className="self-start rounded-2xl border-weather-edge/60 bg-weather-panel"
            >
              <ButtonIcon as={ArrowLeftIcon} className="text-weather-on-sky" />
              <ButtonText className="text-weather-on-sky">Back to home</ButtonText>
            </Button>

            <Heading size="2xl" bold className="w-full text-center mb-2">
              World Weather
            </Heading>

            {locations.map((location) => (
              <WeatherVideoCard
                key={location.city}
                country={location.country}
                city={location.city}
                latitude={location.latitude}
                timeString={getLocalTime(now, location.timezone)}
                weather={location.weather}
                error={location.error}
              />
            ))}
          </VStack>
        </ScrollView>
      </SafeAreaView>
    </Box>
  );
}