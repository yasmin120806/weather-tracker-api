import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Button, ButtonText } from '@/components/ui/button';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SeasonOverviewScreen() {
  const { season } = useLocalSearchParams<{ season: string }>();
  const router = useRouter();

  return (
    <Box className="flex-1 bg-slate-950 p-4">
      <SafeAreaView style={{ flex: 1 }}>
        <Button onPress={() => router.back()} className="self-start mb-4">
          <ButtonText>Back</ButtonText>
        </Button>
        <Heading size="xl" className="text-white">
          {season?.toUpperCase()} Destinations
        </Heading>
      </SafeAreaView>
    </Box>
  );
}