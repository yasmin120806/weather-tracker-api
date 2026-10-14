import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Image, View } from 'react-native';
import { ArrowLeft, ChevronRight, Clock, Trash2 } from 'lucide-react-native';

import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { getWeather, type WeatherResponse } from '@/lib/weather-api';
import { getSearchHistory, clearAllSearchHistory, type HistoryItem } from '@/lib/history-search';

export default function SearchHistoryScreen() {
  const router = useRouter();
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherResponse>>({});

  // 1. Load history items from storage
  useEffect(() => {
    let isMounted = true;
    async function init() {
      const saved = await getSearchHistory();
      if (isMounted) setHistoryList(saved);
    }
    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch preview weather and photos for each item
  useEffect(() => {
    let isMounted = true;
    async function loadHistoryWeather() {
      for (const item of historyList) {
        if (!weatherMap[item.city]) {
          try {
            const data = await getWeather(item.city);
            if (isMounted) {
              setWeatherMap((prev) => ({ ...prev, [item.city]: data }));
            }
          } catch {
            // Silently fallback
          }
        }
      }
    }
    if (historyList.length > 0) {
      void loadHistoryWeather();
    }
    return () => {
      isMounted = false;
    };
  }, [historyList]);

  const handleClear = async () => {
    await clearAllSearchHistory();
    setHistoryList([]);
  };

  return (
    <Box className="flex-1 bg-sky-200">
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <VStack space="lg" className="p-4">
            <HStack className="items-center justify-between">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-2xl bg-white/70 active:bg-white"
              >
                <ArrowLeft size={20} color="#0f172a" />
              </Pressable>
              <Heading size="xl" bold className="text-blue-950">
                Search History
              </Heading>
              {historyList.length > 0 ? (
                <Pressable
                  onPress={handleClear}
                  className="h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 active:bg-rose-200"
                >
                  <Trash2 size={18} color="#e11d48" />
                </Pressable>
              ) : (
                <Box className="w-10" />
              )}
            </HStack>

            {historyList.length === 0 ? (
              <Box className="mt-16 items-center justify-center p-8 rounded-3xl bg-white/50 border border-blue-200">
                <Clock size={40} color="#0284c7" />
                <Text className="text-base font-bold text-blue-950 mt-3">No Search History</Text>
                <Text className="text-xs text-blue-800/70 text-center mt-1">
                  Search any city from the main page to see it here.
                </Text>
              </Box>
            ) : (
              <VStack space="md" className="mt-2">
                {historyList.map((item) => {
                  const itemWeather = weatherMap[item.city];
                  const photoUrl =
                    itemWeather?.location?.photo?.image_url ??
                    itemWeather?.location?.photo?.thumbnail_url ??
                    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800';

                  const temp = itemWeather ? Math.round(itemWeather.current.temperature_2m) : null;
                  const tempUnit = itemWeather?.units?.temperature_2m_max ?? '°C';

                  return (
                    <Pressable
                      key={item.city}
                      onPress={() => {
                        router.push({
                          pathname: '/location/[city]' as any,
                          params: { city: item.city, country: item.country, photoUrl },
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
                          backgroundColor: '#0f172a',
                          borderWidth: 1,
                          borderColor: '#1e293b',
                        }}
                      >
                        <Image
                          source={{ uri: photoUrl }}
                          style={StyleSheet.absoluteFillObject}
                          resizeMode="cover"
                        />
                        <View
                          pointerEvents="none"
                          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(2, 6, 23, 0.48)' }]}
                        />
                        <View style={{ flex: 1, justifyContent: 'space-between', padding: 16 }}>
                          <HStack className="items-start justify-between">
                            <VStack space="xs">
                              <Heading size="lg" className="text-white font-bold">{item.city}</Heading>
                              <Text className="text-xs text-slate-300 font-medium">{item.country}</Text>
                            </VStack>
                            <HStack space="xs" className="items-center rounded-full bg-white/20 px-2.5 py-0.5">
                              <Clock size={11} color="#ffffff" />
                              <Text className="text-[11px] font-semibold text-white">{item.searchedAt}</Text>
                            </HStack>
                          </HStack>

                          <HStack className="items-end justify-between">
                            {itemWeather ? (
                              <VStack>
                                <Text size="3xl" bold className="text-white leading-none">
                                  {temp}
                                  <Text size="lg" className="text-white font-normal">{tempUnit}</Text>
                                </Text>
                                <Text className="text-[11px] text-slate-200 mt-1">
                                  Wind: {itemWeather.current.wind_speed_10m} km/h
                                </Text>
                              </VStack>
                            ) : (
                              <Text className="text-xs text-slate-300">Loading forecast...</Text>
                            )}
                            <HStack space="xs" className="items-center bg-teal-500/20 px-2.5 py-1 rounded-xl border border-teal-500/30">
                              <Text className="text-xs text-teal-300 font-medium">View</Text>
                              <ChevronRight size={14} color="#5EEAD4" />
                            </HStack>
                          </HStack>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </VStack>
            )}
          </VStack>
        </ScrollView>
      </SafeAreaView>
    </Box>
  );
}