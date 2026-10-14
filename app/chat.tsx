import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router'; // If receiving weather data via route params
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner } from '@/components/ui/button';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { askChatbot, type ChatMessageItem, type WeatherResponse } from '@/lib/weather-api';
import { Pressable } from '@/components/ui/pressable';
import { ArrowLeft } from 'lucide-react-native';

interface ChatScreenProps {
  weather?: WeatherResponse | null;
}

export default function ChatScreen({ weather }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      role: 'assistant',
      content: 'Hi! I am Skybot! Ask me anything about current weather, forecasts, or packing advice.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');

    const newHistory: ChatMessageItem[] = [
      ...messages,
      { role: 'user', content: userText },
    ];
    setMessages(newHistory);
    setLoading(true);

    // Build the weather snapshot safely inside the function:
    const backendPayload = weather
      ? {
          city: weather.location?.city,
          country: weather.location?.country,
          temperature: weather.current?.temperature_2m,
          conditions: weather.current?.weather_code,
          uv_index: weather.current?.uv_index,
          aqi: weather.current?.air_quality?.us_aqi,
          forecast_high: weather.seven_day_forecast?.temperature_2m_max?.[0],
          forecast_low: weather.seven_day_forecast?.temperature_2m_min?.[0],
        }
      : null;

    try {
      // Pass both message history AND the backend data payload
      const reply = await askChatbot(newHistory, backendPayload ?? undefined);
      setMessages([...newHistory, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([
        ...newHistory,
        { role: 'assistant', content: 'Sorry, I could not connect to the assistant.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="flex-1 bg-sky-200">
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/20 active:bg-white/30"
          >
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
          <FlatList
          data={messages}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            // Prevent rendering empty bubbles
            if (!item.content || !item.content.trim()) return null;

            const isUser = item.role === 'user';
            return (
              <Box
                className={`max-w-[80%] rounded-2xl p-3.5 ${
                  isUser
                    ? 'self-end bg-blue-600'
                    : 'self-start bg-slate-800'
                }`}
              >
                <Text className="text-sm text-white">{item.content}</Text>
              </Box>
            );
          }}
          ListFooterComponent={
            loading ? (
              <Box className="self-start bg-slate-800 rounded-2xl px-4 py-2.5">
                <Text className="text-xs text-slate-300">SkyBot is thinking...</Text>
              </Box>
            ) : null
          }
        />

          <HStack space="sm" className="p-3 border-t border-slate-800 items-center">
            <Input className="h-12 flex-1 rounded-xl bg-slate-900 border-slate-800 px-3">
              <InputField
                value={input}
                onChangeText={setInput}
                placeholder="Ask about weather, outfits, trips..."
                placeholderTextColor="#ffffff"
                className="text-black-muted"
                onSubmitEditing={handleSend}
              />
            </Input>
            <Button
              className="h-12 px-4 rounded-xl border bg-blue-50 border-blue-400"
              onPress={handleSend}
              isDisabled={loading}
            >
              {loading ? (
                <ButtonSpinner color="#022C22" />
              ) : (
                <Text className="font-bold text-blue-400">Send</Text>
              )}
            </Button>
          </HStack>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Box>
  );
}