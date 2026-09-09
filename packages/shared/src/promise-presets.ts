import type { Localized } from './i18n.ts';
import { FEATURED_PRESET_COUNT } from './config.ts';
import { codepointLength, normalizeInput } from './text.ts';
import { validateReward } from './validation.ts';

export const PROMISE_PRESETS_CONFIG_KEY = 'promise_featured_presets';

export interface PromiseFeaturedPresets {
  reward: Localized<readonly string[]>;
  penalty: Localized<readonly string[]>;
}

function asLabels(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length !== FEATURED_PRESET_COUNT) return null;
  const labels: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const label = normalizeInput(item);
    if (codepointLength(label) < 1 || !validateReward(label).valid) return null;
    labels.push(label);
  }
  return new Set(labels).size === labels.length ? labels : null;
}

function asLocalizedLabels(value: unknown): Localized<readonly string[]> | null {
  if (value === null || typeof value !== 'object') return null;
  const ko = asLabels(Reflect.get(value, 'ko'));
  const en = asLabels(Reflect.get(value, 'en'));
  return ko === null || en === null ? null : { ko, en };
}

export function asPromiseFeaturedPresets(value: unknown): PromiseFeaturedPresets | null {
  if (value === null || typeof value !== 'object') return null;
  const reward = asLocalizedLabels(Reflect.get(value, 'reward'));
  const penalty = asLocalizedLabels(Reflect.get(value, 'penalty'));
  return reward === null || penalty === null ? null : { reward, penalty };
}
