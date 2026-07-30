import { EMPTY_PROMISE_DRAFT, type PromiseDraftFields } from './promise-draft.ts';
import {
  DRAFT_AUTOSAVE_DELAY_MS,
  DraftAutosave,
  PromiseDraftRepository,
} from './draft-autosave.ts';

const encryptedStore = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

const draft: PromiseDraftFields = {
  ...EMPTY_PROMISE_DRAFT,
  title: '주 3회 달리기',
};

describe('SCR-A03 암호화 로컬 초안', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    encryptedStore.getItem.mockReset();
    encryptedStore.setItem.mockReset();
    encryptedStore.removeItem.mockReset();
    encryptedStore.setItem.mockResolvedValue(undefined);
    encryptedStore.removeItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('사용자와 서버 DRAFT별 키로 암호화 저장소를 분리한다', async () => {
    const repository = new PromiseDraftRepository(encryptedStore);

    await repository.save('user-1', null, draft);
    await repository.save('user-2', 'promise-2', draft);

    expect(encryptedStore.setItem).toHaveBeenNthCalledWith(
      1,
      'lf.promise-draft.user-1.new',
      JSON.stringify(draft),
    );
    expect(encryptedStore.setItem).toHaveBeenNthCalledWith(
      2,
      'lf.promise-draft.user-2.promise-2',
      JSON.stringify(draft),
    );
  });

  test('입력 변경 뒤 3초가 지나야 최신 값 한 번만 저장한다', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const autosave = new DraftAutosave(save);

    autosave.schedule({ ...draft, title: '첫 값' });
    await jest.advanceTimersByTimeAsync(DRAFT_AUTOSAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();

    autosave.schedule({ ...draft, title: '최신 값' });
    await jest.advanceTimersByTimeAsync(DRAFT_AUTOSAVE_DELAY_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ ...draft, title: '최신 값' });
  });

  test('화면 이탈 flush는 대기 시간을 건너뛰고 저장하며 예약 저장을 취소한다', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const autosave = new DraftAutosave(save);
    autosave.schedule(draft);

    await autosave.flush();
    await jest.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(draft);
  });

  test('서버 저장 성공 후 사용자별 로컬 초안을 삭제한다', async () => {
    const repository = new PromiseDraftRepository(encryptedStore);

    await repository.remove('user-1', 'promise-1');

    expect(encryptedStore.removeItem).toHaveBeenCalledWith(
      'lf.promise-draft.user-1.promise-1',
    );
  });
});
