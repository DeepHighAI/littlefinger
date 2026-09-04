import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createMobileSupabaseRuntime,
  createMobileSupabaseClient,
  mobileFunctionUrl,
  registerSessionAutoRefresh,
} from './supabase.ts';

describe('createMobileSupabaseClient', () => {
  test('암호화 저장소로 세션을 지속하고 URL 자동 감지는 끄며 PKCE 로 고정한다', () => {
    // storage 가 빠지면 재실행 때 세션이 사라지고, detectSessionInUrl 이 켜지면 window 가
    // 없는 네이티브에서 웹 콜백 파서를 타게 된다.
    // flowType 이 빠지면 auth-js 기본값 implicit 으로 되돌아가, 커스텀 스킴 콜백에
    // refresh_token 이 실려 같은 스킴을 등록한 앱에 계정이 통째로 넘어간다.
    const client = { auth: {} } as SupabaseClient;
    const createClient = jest.fn().mockReturnValue(client);
    const storage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    expect(
      createMobileSupabaseClient({
        anonKey: 'anon-key',
        createClient,
        storage,
        url: 'https://project.supabase.co',
      }),
    ).toBe(client);

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'anon-key',
      {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
          lock: expect.any(Function),
        },
      },
    );
  });
});

describe('createMobileSupabaseRuntime', () => {
  test('암호화 저장소를 쓰는 클라이언트를 한 번만 만들고 AppState를 연결한다', () => {
    // 화면마다 클라이언트를 새로 만들면 세션 갱신 타이머와 AppState 리스너가 중복된다.
    const client = {
      auth: {
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
    } as unknown as SupabaseClient;
    const createClient = jest.fn().mockReturnValue(client);
    const addEventListener = jest.fn().mockReturnValue({ remove: jest.fn() });
    const runtime = createMobileSupabaseRuntime({
      anonKey: 'anon-key',
      appState: { addEventListener },
      asyncStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      createClient,
      randomBytes: () => new Uint8Array(32),
      secureStore: {
        getItemAsync: jest.fn(),
        setItemAsync: jest.fn(),
        deleteItemAsync: jest.fn(),
      },
      url: 'https://project.supabase.co/',
    });

    expect(runtime.getClient()).toBe(client);
    expect(runtime.getClient()).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(runtime.functionUrl('user-provision')).toBe(
      'https://project.supabase.co/functions/v1/user-provision',
    );
  });
});

describe('mobileFunctionUrl', () => {
  test('프로젝트 URL 끝의 슬래시를 제거한다', () => {
    // //functions 는 배포 누락과 같은 404라 원인 구분이 어렵다.
    expect(
      mobileFunctionUrl('https://project.supabase.co/', 'user-provision'),
    ).toBe('https://project.supabase.co/functions/v1/user-provision');
  });
});

describe('registerSessionAutoRefresh', () => {
  test('active 에서는 갱신을 시작하고 백그라운드에서는 멈춘다', () => {
    // AppState 연결이 빠지면 백그라운드 타이머가 중단된 뒤 복귀해도 세션이 갱신되지 않는다.
    const startAutoRefresh = jest.fn();
    const stopAutoRefresh = jest.fn();
    const remove = jest.fn();
    let onChange: ((state: string) => void) | undefined;
    const appState = {
      addEventListener: jest.fn((_event: 'change', listener: (state: string) => void) => {
        onChange = listener;
        return { remove };
      }),
    };

    const unregister = registerSessionAutoRefresh(
      { startAutoRefresh, stopAutoRefresh },
      appState,
    );
    onChange?.('active');
    onChange?.('background');

    expect(startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(stopAutoRefresh).toHaveBeenCalledTimes(1);
    unregister();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
