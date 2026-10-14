import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { Image } from '@/components/ui/image';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, {useEffect} from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/home');
    }, 6000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Box className="flex-1">
      <LinearGradient
        colors={['#38bdf8', '#2563eb', '#1e3a8a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <Center className="flex-1 gap-0">
          <Box className="flex-1 items-center justify-center gap-5">
            <Box className="h-24 w-24 overflow-hidden rounded-2xl bg-primary">
              <Image
                source={require('@/assets/images/earth-icon.webp')}
                alt="Earth"
                size="full"
                className="h-full w-full"
                resizeMode="cover"
              />
            </Box>

            <Text bold size="3xl" className="text-white">
              Weather Tracking App
            </Text>
          </Box>

          <Box className="pb-20">
            <Spinner size="large" color="white" />
          </Box>
        </Center>
      </LinearGradient>
    </Box>
  );
}
