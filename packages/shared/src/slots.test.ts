import { describe, expect, test } from 'vitest';

import { asSlotStatusResponse } from './slots.ts';

describe('asSlotStatusResponse', () => {
  test('정확한 형태만 통과한다', () => {
    expect(asSlotStatusResponse({ capacity: 5, used: 0 })).toEqual({ capacity: 5, used: 0 });
    expect(asSlotStatusResponse({ capacity: 6, used: 6 })).toEqual({ capacity: 6, used: 6 });
  });

  test('형태가 다르면 null 이다', () => {
    expect(asSlotStatusResponse(null)).toBeNull();
    expect(asSlotStatusResponse([])).toBeNull();
    expect(asSlotStatusResponse({})).toBeNull();
    expect(asSlotStatusResponse({ capacity: 5 })).toBeNull();
    expect(asSlotStatusResponse({ capacity: 5, used: 0, extra: 1 })).toBeNull();
    expect(asSlotStatusResponse({ capacity: '5', used: 0 })).toBeNull();
    expect(asSlotStatusResponse({ capacity: 5.5, used: 0 })).toBeNull();
    expect(asSlotStatusResponse({ capacity: -1, used: 0 })).toBeNull();
  });
});
