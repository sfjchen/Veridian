import { useEffect } from 'react';
import { useWindowDimensions, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'veridian:chat-height-ratio';
const DEFAULT_RATIO = 0.6;
const MIN_RATIO = 0.25;
const MAX_RATIO = 0.85;

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
}

export function usePanelResize() {
  const { height: windowHeight } = useWindowDimensions();
  const ratio = useSharedValue(DEFAULT_RATIO);
  const startRatio = useSharedValue(DEFAULT_RATIO);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= MIN_RATIO && parsed <= MAX_RATIO) {
        ratio.value = parsed;
      }
    });
  }, []);

  const persistRatio = (val: number) => {
    AsyncStorage.setItem(STORAGE_KEY, val.toString());
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      startRatio.value = ratio.value;
    })
    .onUpdate((e) => {
      ratio.value = clamp(
        startRatio.value + -e.translationY / windowHeight,
        MIN_RATIO,
        MAX_RATIO,
      );
    })
    .onEnd(() => {
      runOnJS(persistRatio)(ratio.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    height: ratio.value * windowHeight,
  }));

  return { animatedStyle, gesture } as const;
}
