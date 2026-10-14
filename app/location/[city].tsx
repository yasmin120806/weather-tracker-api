import React, { useEffect, useState, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Image, View } from 'react-native';
import { ArrowLeft, Wind, Droplets, Compass, Calendar, ShieldAlert, Volume2, VolumeX, Sparkles, Eye, Cloud, HeartIcon } from 'lucide-react-native';

import { useAudioPlayer} from 'expo-audio';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { getWeather, saveFavorite, type WeatherResponse } from '@/lib/weather-api';
import { getCachedCityWeather, saveCachedCityWeather } from '@/lib/local-db';
import { Card } from '@/components/ui/card';
import { Button, ButtonIcon } from '@/components/ui/button';


// Ambient sound audio streams matching conditions
const SOUND_SCAPES: Record<string, string> = {
  rain: 'https://cdn.freesound.org/previews/253/253886_4056007-lq.mp3', // Soft rain
  night: 'https://cdn.freesound.org/previews/568/568853_11861866-lq.mp3', // Crickets & gentle night
  clear: 'https://cdn.freesound.org/previews/416/416529_5121236-lq.mp3', // Forest birds & wind
};

function isColorLight(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  // Standard luminance formula (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

function getCondition(code?: number | null) {
  if (code == null) return { icon: '🌤️', label: 'Cloudy' };
  if (code === 0) return { icon: '☀️', label: 'Clear' };
  if (code <= 3) return { icon: '🌤️', label: 'Partly cloudy' };
  if (code <= 48) return { icon: '☁️', label: 'Cloudy' };
  if (code <= 67) return { icon: '🌧️', label: 'Rain' };
  if (code <= 77) return { icon: '🌨️', label: 'Snow' };
  if (code <= 82) return { icon: '🌧️', label: 'Rain showers' };
  return { icon: '⛈️', label: 'Thunderstorm' };
}

function getAqiStatus(aqi?: number) {
  if (aqi == null) return { label: 'Unknown', color: 'text-slate-400', badgeBg: 'bg-slate-700/50' };
  if (aqi <= 50) return { label: 'Good', color: 'text-emerald-400', badgeBg: 'bg-emerald-500/20' };
  if (aqi <= 100) return { label: 'Moderate', color: 'text-yellow-400', badgeBg: 'bg-yellow-500/20' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: 'text-orange-400', badgeBg: 'bg-orange-500/20' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'text-rose-400', badgeBg: 'bg-rose-500/20' };
  return { label: 'Very Unhealthy', color: 'text-purple-400', badgeBg: 'bg-purple-500/20' };
}

function calculateStargazingScore(cloudCover: number, humidity: number, weatherCode: number) {
  if (weatherCode >= 51) {
    return { score: 10, label: 'Poor (Overcast/Rain)', advice: 'Thick storm clouds obstruct any view.' };
  }
  // Cloud cover is the primary deterrent, humidity introduces haze
  const deductions = cloudCover * 0.7 + (humidity > 70 ? (humidity - 70) * 0.8 : 0);
  const score = Math.max(5, Math.min(100, Math.round(100 - deductions)));

  if (score >= 80) return { score, label: 'Optimal', advice: 'Crystal clear sky! Great for seeing constellations.' };
  if (score >= 50) return { score, label: 'Moderate', advice: 'Partial haze or high clouds. Bright planets visible.' };
  return { score, label: 'Low Visibility', advice: 'Cloud blankets will block most celestial objects.' };
}


export default function CityWeatherDetailScreen() {
  const router = useRouter();
  const { city, country, photoUrl } = useLocalSearchParams<{
    city: string;
    country?: string;
    photoUrl?: string;
  }>();

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const isRain = (weather?.current?.weather_code ?? 0) >= 51;
  const audioUri = isRain ? SOUND_SCAPES.rain : SOUND_SCAPES.night;
  const [isBrightImage, setIsBrightImage] = useState(false);

  const player = useAudioPlayer(audioUri);

  const backgroundImage =
    photoUrl ||
    weather?.location?.photo?.image_url ||
    weather?.location?.photo?.thumbnail_url ||
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800';

  useEffect(() => {
    if (!city) return;
    const cached = getCachedCityWeather(city);
    if (cached) setWeather(cached);

    void getWeather(city).then((data) => {
      setWeather(data);
      saveCachedCityWeather(city, data);
    });
  }, [city]);

  const toggleAmbientSound = () => {
    if (!player) return;
    if (isPlayingAudio) {
      player.pause();
      setIsPlayingAudio(false);
    } else {
      player.loop = true;
      player.play();
      setIsPlayingAudio(true);
    }
  };

  async function handleSaveFavorite() {
  const targetCity = weather?.location?.city ?? city;
  if (!targetCity || isSaving) return;

  setIsSaving(true);
    try {
      const msg = await saveFavorite(targetCity); //
      setIsSaved(true);
      setSavedMessage(msg);
      setTimeout(() => {
        setSavedMessage(null);
        setIsSaved(false);
      }, 3000);
    } catch (err: any) {
      setSavedMessage(err?.message ?? 'Failed to save favorite');
      setTimeout(() => setSavedMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }

  const cloudCover = (weather?.hourly as any)?.cloud_cover?.[0] ?? 25;
  const humidity = weather?.current?.relative_humidity_2m ?? 60;
  const starAnalysis = calculateStargazingScore(cloudCover, humidity, weather?.current?.weather_code ?? 0);

  
  const condition = getCondition(weather?.current?.weather_code);
  const temp = weather ? Math.round(weather.current.temperature_2m) : null;
  const tempUnit = weather?.units?.temperature_2m_max ?? '°C';
  const uv = weather?.current?.uv_index || 'N/A';
  const airquality = weather?.current?.air_quality;
  const usAqi = airquality?.us_aqi;
  const pm25 = airquality?.pm2_5;
  const pm10 = airquality?.pm10;


  const status = getAqiStatus(usAqi);
  const dailyData = (weather as any)?.seven_day_forecast ?? (weather as any)?.daily;

  const dynamicTheme = isBrightImage
    ? {
        cardBg: 'rgba(15, 23, 42, 0.85)', // Dark frosted panel when image is bright
        textColor: '#FFFFFF',
        subTextColor: '#CBD5E1',
        overlayColor: 'rgba(0, 0, 0, 0.35)', // Subtle contrast scrim
      }
    : {
        cardBg: 'rgba(255, 255, 255, 0.20)', // Glassmorphic light panel when image is dark
        textColor: '#FFFFFF',
        subTextColor: '#E2E8F0',
        overlayColor: 'rgba(2, 6, 23, 0.50)',
      };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <Image
        source={{ uri: backgroundImage }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: dynamicTheme.overlayColor },
        ]}
      />

      {/* Layer 3: Weather Details Content */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        {/* Navigation Bar */}
        <HStack className="items-center justify-between px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-white/20 active:bg-white/30"
          >
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
          <Button
            size="icon"
            className="h-12 w-12 rounded-2xl bg-weather-sky"
            onPress={handleSaveFavorite}
            isDisabled={isSaving}
          >
            <ButtonIcon as={HeartIcon} className="text-weather-on-sky" />
          </Button>
          <Text className="text-sm font-semibold tracking-wide text-white/90">
            {country ?? weather?.location?.country ?? 'Forecast'}
          </Text>
          <Pressable
              onPress={toggleAmbientSound}
              className={`flex-row items-center px-3.5 py-2 rounded-2xl border ${
                isPlayingAudio 
                  ? 'bg-teal-500/20 border-teal-400' 
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              {isPlayingAudio ? <Volume2 size={16} color="#5EEAD4" /> : <VolumeX size={16} color="#94A3B8" />}
              <Text className={`text-xs font-semibold ml-2 ${isPlayingAudio ? 'text-teal-300' : 'text-slate-400'}`}>
                {isPlayingAudio ? 'Ambient Sound Active' : 'Soundscape Off'}
              </Text>
              </Pressable>
          <Box className="w-10" />
        </HStack>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        >
          {/* Main Weather Summary */}
          <VStack space="xs" className="items-center my-6">
            <Heading size="3xl" bold className="text-white text-center">
              {city}
            </Heading>
            <Text className="text-base text-slate-200 mt-1">
              {condition.icon} {condition.label}
            </Text>

            {loading && !weather ? (
              <Skeleton className="h-24 w-36 rounded-2xl bg-white/20 my-4" />
            ) : (
              <HStack className="items-start my-2">
                <Text className="text-8xl font-bold text-white leading-none">
                  {temp ?? '--'}
                </Text>
                <Text className="text-3xl font-light text-white mt-1">
                  {tempUnit}
                </Text>
              </HStack>
            )}
          </VStack>

          {/* Quick Stats Grid */}
          {weather && (
            <VStack space="md" className="mt-4">
              <HStack space="md" className="w-full">
                {/* Wind */}
                <Box className="flex-1 rounded-2xl bg-sky-100/50 p-4 border border-white/15" style={{ backgroundColor: dynamicTheme.cardBg }}>
                  <HStack space="xs" className="items-center mb-1">
                    <Wind size={16} color="#93C5FD" />
                    <Text className="text-md text-indigo-900">Wind</Text>
                  </HStack>
                  <Text className="text-lg font-bold text-indigo-900">
                    {weather.current.wind_speed_10m} km/h
                  </Text>
                </Box>

                {/* Humidity */}
                <Box className="flex-1 rounded-2xl bg-sky-100/50 p-4 border border-white/15" style={{ backgroundColor: dynamicTheme.cardBg }}>
                  <HStack space="xs" className="items-center mb-1">
                    <Droplets size={16} color="#5a9be6" />
                    <Text className="text-md text-indigo-900">Humidity</Text>
                  </HStack>
                  <Text className="text-lg font-bold text-indigo-900">
                    {weather.current.relative_humidity_2m}%
                  </Text>
                </Box>

                {/* Wind Direction */}
                <Box className="flex-1 rounded-2xl bg-sky-100/50 p-4 border border-white/15" style={{ backgroundColor: dynamicTheme.cardBg }}>
                  <HStack space="xs" className="items-center mb-1">
                    <Compass size={16} color="#93C5FD" />
                    <Text className="text-md text-indigo-900">Direction</Text>
                  </HStack>
                </Box>
              </HStack>

              <Box className='flex-1 rounded-2xl bg-sky-100/50 p-4 border border-white/15' style={{ backgroundColor: dynamicTheme.cardBg }}>
                <VStack>
                  <HStack className="items-center justify-between mb-3">
                    <HStack space="xs" className="items-center">
                      <ShieldAlert size={20} color="#93C5FD" />
                      <Text className="text-md font-bold uppercase tracking-wider text-indigo-900">
                        Air Quality
                      </Text>
                    </HStack>

                    <Box className={`px-2.5 py-0.5 rounded-full ${status.badgeBg}`}>
                      <Text className={`text-md font-semibold ${status.color}`}>
                        {status.label}
                      </Text>
                    </Box>
                  </HStack>
                  // 3 metrics ROW
                  <HStack space='md' className='flex-1 justify-between items-center py-2 px-3 rounded-2xl'>
                    <Box className="rounded-2xl bg-sky-100/50 p-4 border border-white/15">
                      <Text className='text-md font-semibold text-indigo-900'>
                        AQI: {usAqi ?? '--'}
                      </Text>
                    </Box>
                    <Box className="rounded-2xl bg-sky-100/50 p-4 border border-white/15">
                      <Text className='text-md font-semibold text-indigo-900'>
                        PM2.5: {pm25 != null ? Math.round(pm25) : '--'} µg/m³
                      </Text>
                    </Box>
                    <Box className="rounded-2xl bg-sky-100/50 p-4 border border-white/15">
                    <Text className='text-md font-semibold text-indigo-900'>
                      PM10: {pm10 != null ? Math.round(pm10) : '--'} µg/m³
                    </Text>
                    </Box>
                  </HStack>
                </VStack>
              </Box>




// ---------------------- HOURLY AND 7 DAYS -----------------------------
              {/* Hourly Forecast Track */}
              {weather.hourly?.time && (
                <Box className="rounded-3xl bg-sky-100/50 p-4 border border-white/15 mt-2" style={{ backgroundColor: dynamicTheme.cardBg }}>
                  <Text className="text-md font-semibold uppercase text-indigo-900 tracking-wider mb-3">
                    Hourly Forecast
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <HStack space="md">
                      {weather.hourly.time.slice(0, 8).map((timeStr, idx) => {
                        const hTemp = Math.round(weather.hourly.temperature_2m[idx]);
                        const hCode = weather.hourly.weather_code[idx];
                        const hCond = getCondition(hCode);
                        const hourNum = parseInt(timeStr.split('T')[1]?.split(':')[0] ?? '0', 10);
                        const isPm = hourNum >= 12;
                        const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;

                        return (
                          <VStack
                            key={timeStr}
                            className="items-center py-2 px-3 rounded-2xl border border-blue-200 shadow-xs bg-white/10 min-w-[56px]"
                            space="xs"
                          >
                            <Text className="text-[11px] text-indigo-900">
                              {hour12} {isPm ? 'PM' : 'AM'}
                            </Text>
                            <Text className="text-lg my-1">{hCond.icon}</Text>
                            <Text className="text-xs font-bold text-indigo-900">
                              {hTemp}°
                            </Text>
                          </VStack>
                        );
                      })}
                    </HStack>
                  </ScrollView>
                </Box>
              )}

              {dailyData?.time && dailyData.time.length > 0 && (
                <Box className='rounded-3xl bg-sky-100/50 p-4 border border-white/15 mt-2' style={{ backgroundColor: dynamicTheme.cardBg }}>
                  <HStack space='xs' className='items-center mb-3'>
                    <Calendar size={14} color='#93C5FD'></Calendar>
                    <Text className='text-md font-semibold uppercase text-indigo-900 tracking-wider'>
                      7 Day Forecast
                    </Text>
                  </HStack>

                  <VStack space='sm'>
                    {dailyData.time.slice(0, 7).map((dateStr: string, idx:number) => {
                      const dayName = idx === 0 ? 'Today' : new Intl.DateTimeFormat('en-US', {weekday: 'short'}).format(new Date(dateStr));
                      const dayCode = dailyData.weather_code?.[idx];
                      const dayCond = getCondition(dayCode);
                      const maxTemp = Math.round(dailyData.temperature_2m_max?.[idx] ?? 0);
                      const minTemp = Math.round(dailyData.temperature_2m_min?.[idx] ?? 0);

                      return(
                        <VStack
                        key={dateStr}
                        className='items-center justify-between py-2 border-b border-white/10 last:border-b-0'
                        >
                          <HStack>
                          <Text className='w-16 text-md font-medium text-indigo-900'>
                            {dayName}
                          </Text>

                          <Text className='w-16 text-md font-medium text-indigo-900'>
                            {dayCond.icon}
                          </Text>

                          <Text className='w-16 text-md font-medium text-indigo-900'>
                            {dayCond.label}
                          </Text>

                          <Text className='w-16 text-md font-medium text-indigo-900'>
                            {maxTemp}°
                          </Text>

                          <Text className='w-16 text-md font-medium text-indigo-900'>
                            {minTemp}°
                          </Text>
                          </HStack>
                        </VStack>
                      )
                    })}
                  </VStack>
                </Box>
              ) }

            <Card className="flex-1 rounded-2xl bg-sky-100/50 p-4 border border-white/15" style={{ backgroundColor: dynamicTheme.cardBg }}>
              <HStack className="justify-between items-center mb-4">
                <HStack space="xs" className="items-center">
                  <Sparkles size={18} color="#C084FC" />
                  <Heading size="md" className="text-white font-bold ml-1">
                    Stargazing Index
                  </Heading>
                </HStack>
                <Text className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  Night Sky
                </Text>
              </HStack>

              <HStack className="items-center justify-between my-2">
                <VStack space="xs">
                  <Text className="text-5xl font-light text-white leading-none">
                    {starAnalysis.score}
                    <Text className="text-xl font-normal text-indigo-300">/100</Text>
                  </Text>
                  <Text className="text-sm font-semibold text-indigo-400 mt-1">
                    {starAnalysis.label}
                  </Text>
                </VStack>

                <View className="h-16 w-16 rounded-full bg-indigo-900/40 border border-indigo-500/40 items-center justify-center">
                  <Eye size={28} color="#C084FC" />
                </View>
              </HStack>

              <View className="h-px bg-slate-800 my-4" />

              <Text className="text-xs text-slate-300 leading-relaxed">
                {starAnalysis.advice}
              </Text>
            </Card>
            </VStack>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}