import { useEffect, useState } from 'react';
import type { PromiseFeaturedPresets } from '@littlefinger/shared';
import { AppState } from 'react-native';

import { DEFAULT_FEATURED_PRESETS } from './promise-draft.ts';
import { readFeaturedPresets, subscribeFeaturedPresets } from './promise-presets-native.ts';

export function usePromisePresets(): PromiseFeaturedPresets {
  const [featured, setFeatured] = useState(DEFAULT_FEATURED_PRESETS);

  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = (): void => {
      const currentRequest = ++request;
      void readFeaturedPresets().then((value) => {
        // 늦게 도착한 이전 조회가 더 최신 추천을 덮어쓰지 않게 한다.
        if (active && currentRequest === request && value !== null) setFeatured(value);
      }).catch(() => {
        // 통신 실패로 약속 작성을 막지 않고 마지막 정상 문구를 유지한다.
      });
    };
    const unsubscribe = subscribeFeaturedPresets(refresh);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => {
      active = false;
      unsubscribe();
      appState.remove();
    };
  }, []);

  return featured;
}
