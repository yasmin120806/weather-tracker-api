import React, { memo, useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { ArrowLeftIcon } from 'lucide-react-native';

import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import {
  getFavorites,
  getWeather,
  type FavoriteCity,
  type WeatherResponse,
} from '@/lib/weather-api';

type FavoriteWeather = FavoriteCity & {
  weather?: WeatherResponse;
  error?: string;
};

type FavoriteCardProps = {
  item: FavoriteWeather;
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  spacing: number;
  onPress: () => void;
};

const FavoriteCard = memo(function FavoriteCard({
  item,
  index,
  scrollX,
  itemWidth,
  spacing,
  onPress,
}: FavoriteCardProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const cardPosition = index * (itemWidth + spacing);
    return {
      opacity: interpolate(
        scrollX.value,
        [
          cardPosition - itemWidth,
          cardPosition,
          cardPosition + itemWidth,
        ],
        [0.6, 1, 0.6],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            [
              cardPosition - itemWidth,
              cardPosition,
              cardPosition + itemWidth,
            ],
            [0.9, 1, 0.9],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const weather = item.weather;
  const condition = getCondition(weather?.current?.weather_code ?? 0);
  
  // Extract photo URL with guaranteed scenic fallback
  const photoUrl =
    weather?.location?.photo?.image_url ||
    weather?.location?.photo?.thumbnail_url ||
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';

  return (
    <Box
      style={{
        width: itemWidth + spacing,
        paddingHorizontal: spacing / 2,
      }}
      className="justify-center"
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          className="active:scale-[0.98] transition-transform"
        >
          {/* Bigger card container */}
          <Card
            className="w-full overflow-hidden rounded-3xl border-0 p-0 shadow-2xl"
            style={{ height: 520, position: 'relative', backgroundColor: '#0f172a' }}
          >
            {/* 1. Background Image */}
            <Image
              source={{ uri: photoUrl }}
              resizeMode="cover"
              style={StyleSheet.absoluteFillObject}
            />

            {/* 2. Dark Overlay for readability */}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: 'rgba(2, 6, 23, 0.58)' },
              ]}
            />

            {/* 3. Foreground Content */}
            <Box className="w-full h-full justify-between p-6">
              <VStack space="xs">
                <Text size="5xl" bold className="text-white/40">
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Heading size="3xl" bold className="text-white">
                  {item.name}
                </Heading>
                <Text className="text-slate-200 font-medium">
                  {[item.admin1, item.country].filter(Boolean).join(', ')}
                </Text>
                <Text size="sm" className="mt-1 text-slate-300">
                  {getLocalTime(item.timezone)}
                </Text>
              </VStack>

              {weather ? (
                <VStack className="justify-between pt-6">
                  <Text size="6xl" className="mb-2">{condition.icon}</Text>
                  
                  <Box className="mb-4">
                    <Text size="5xl" bold className="text-white leading-none">
                      {Math.round(weather.current?.temperature_2m ?? 0)}
                      {weather.units?.temperature_2m ?? '°C'}
                    </Text>
                    <Text size="lg" bold className="text-slate-200 mt-1">
                      {condition.label}
                    </Text>
                  </Box>

                  <Box className="flex-row justify-between py-1 border-t border-white/10">
                    <Text className="text-slate-300">Humidity</Text>
                    <Text bold className="text-white">
                      {weather.current?.relative_humidity_2m ?? 0}
                      {weather.units?.relative_humidity_2m ?? '%'}
                    </Text>
                  </Box>

                  <Box className="flex-row justify-between py-1">
                    <Text className="text-slate-300">Wind</Text>
                    <Text bold className="text-white">
                      {weather.current?.wind_speed_10m ?? 0}{' '}
                      {weather.units?.wind_speed_10m ?? 'km/h'}
                    </Text>
                  </Box>
                </VStack>
              ) : (
                <Text className="text-slate-300">Weather data not available</Text>
              )}
            </Box>
          </Card>
        </Pressable>
      </Animated.View>
    </Box>
  );
});

export default function FavoritesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [favorites, setFavorites] = useState<FavoriteWeather[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enlarged card dimensions
  const itemWidth = Math.min(width * 0.85, 460);
  const spacing = 14;
  const sideOffset = (width - itemWidth) / 2;

  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const loadFavorites = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const favoriteCities = await getFavorites();
      const results: FavoriteWeather[] = await Promise.all(
        favoriteCities.map(async (favorite): Promise<FavoriteWeather> => {
          try {
            const weather = await getWeather(favorite.name);
            return { ...favorite, weather };
          } catch (requestError) {
            return {
              ...favorite,
              error:
                requestError instanceof Error
                  ? requestError.message
                  : 'Weather unavailable',
            };
          }
        })
      );
      setFavorites(results);
    } catch (requestError) {
      setFavorites([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to load favorite cities'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites])
  );

  return (
    <Box className="flex-1 bg-white">
      <SafeAreaView style={{ flex: 1 }}>
        <Box className="flex-1">
          <VStack space="md" className="pt-4">
            <Box className="px-4">
              <Button
                size="sm"
                variant="outline"
                onPress={() => router.back()}
                accessibilityLabel="Back to home"
                className="self-start rounded-2xl border-weather-edge/60 bg-weather-panel"
              >
                <ButtonIcon className="text-black" as={ArrowLeftIcon} />
                <ButtonText className="text-black">Back</ButtonText>
              </Button>
            </Box>

            <VStack space="xs" className="items-center pt-2">
              <Heading size="2xl" bold className="text-weather-sky">
                Favorite Cities
              </Heading>
              <Text className="text-weather-sky">
                Swipe to explore your saved cities
              </Text>
            </VStack>
          </VStack>

          <VStack space="lg" className="flex-1 justify-center pt-2">
            {isLoading ? (
              <Box className="flex-1 items-center justify-center">
                <Spinner size="large" />
                <Text className="mt-3 text-muted-foreground">
                  Loading favorites…
                </Text>
              </Box>
            ) : error ? (
              <Box className="mx-4 rounded-xl bg-destructive/10 p-4">
                <Text className="text-destructive">{error}</Text>
              </Box>
            ) : favorites.length === 0 ? (
              <Box className="flex-1 items-center justify-center px-6">
                <Text size="lg" bold>
                  No favorite cities
                </Text>
                <Text className="mt-2 text-center text-muted-foreground">
                  Return home and press the heart beside a city to save it.
                </Text>
              </Box>
            ) : (
              <Animated.FlatList
                data={favorites}
                keyExtractor={(item) => item.name}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={itemWidth + spacing}
                decelerationRate="fast"
                bounces={false}
                contentContainerStyle={{
                  paddingHorizontal: sideOffset,
                  alignItems: 'center',
                }}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                renderItem={({ item, index }) => (
                  <FavoriteCard
                    item={item}
                    index={index}
                    scrollX={scrollX}
                    itemWidth={itemWidth}
                    spacing={spacing}
                    onPress={() =>
                      router.push({
                        pathname: '/location/[city]' as any,
                        params: {
                          city: item.name,
                          photoUrl:
                            item.weather?.location?.photo?.image_url ||
                            item.weather?.location?.photo?.thumbnail_url,
                        },
                      })
                    }
                  />
                )}
              />
            )}
          </VStack>
        </Box>
      </SafeAreaView>
    </Box>
  );
}

function getCondition(code: number) {
  if (code === 0) return { icon: '☀️', label: 'Clear sky' };
  if (code <= 3) return { icon: '🌤️', label: 'Partly cloudy' };
  if (code <= 48) return { icon: '☁️', label: 'Cloudy' };
  if (code <= 67) return { icon: '🌦️', label: 'Rain' };
  if (code <= 82) return { icon: '🌧️', label: 'Showers' };
  return { icon: '⛈️', label: 'Thunderstorms' };
}

function getLocalTime(timezone?: string) {
  if (!timezone) {
    return 'Time unavailable';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return 'Time unavailable';
  }
}