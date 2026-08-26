import {
  EMPTY_PROMISE_DRAFT,
  containsSensitiveNumber,
  penaltyPresets,
  rewardPresets,
  validatePromiseDraft,
} from './promise-draft.ts';

const NOW = new Date('2026-07-30T01:00:00.000Z');

describe('SCR-A03 약속 초안 규칙', () => {
  test('명세 기본값과 보상·벌칙 프리셋을 제공한다', () => {
    expect(EMPTY_PROMISE_DRAFT).toEqual({
      title: '',
      body: '',
      category: '',
      end_date: '',
      keeper: 'BOTH',
      reward: '',
      penalty: '',
      witness_enabled: false,
    });
    // 기본값(ko)은 명세 문구 그대로다 — 로케일 인자를 안 넘기는 기존 호출부의 동결 검증.
    expect(rewardPresets()).toEqual([
      '커피 한 잔 사주기',
      '다음 메뉴 선택권',
      '소원권 1장',
      '주말 계획 결정권',
      '칭찬 세 가지',
    ]);
    expect(penaltyPresets()).toEqual([
      '커피 한 잔 사기',
      '설거지 1주일',
      '다음 데이트 비용',
      '노래방 한 곡',
      '소원권 1장 주기',
    ]);
    // en 은 ko 와 같은 개수의 칩을 제공한다 — 화면 구성이 로케일에 따라 변하지 않는다.
    expect(rewardPresets('en')).toHaveLength(rewardPresets('ko').length);
    expect(penaltyPresets('en')).toHaveLength(penaltyPresets('ko').length);
  });

  test('8개 필드가 유효해야 전송할 수 있고 명세 실패 문구를 그대로 돌려준다', () => {
    const invalid = validatePromiseDraft(EMPTY_PROMISE_DRAFT, NOW);

    expect(invalid.valid).toBe(false);
    expect(invalid.fields).toMatchObject({
      title: '제목을 2자 이상 입력해 주세요.',
      body: '어떤 약속인지 5자 이상 적어주세요.',
      end_date: '종료일은 내일부터 1년 안으로 정해주세요.',
    });
    // 안내 이동은 문구 없는 실패까지 포함한 이 목록을 따른다(카테고리는 이제 선택 항목).
    expect(invalid.invalidFields).toEqual(['title', 'body', 'end_date']);

    expect(
      validatePromiseDraft(
        {
          title: '주 3회 달리기',
          body: '매주 세 번 함께 달린다.',
          category: 'HABIT',
          end_date: '2026-08-10',
          keeper: 'BOTH',
          reward: '커피 한 잔 사주기',
          penalty: '설거지 1주일',
          witness_enabled: true,
        },
        NOW,
      ),
    ).toEqual({ valid: true, fields: {}, invalidFields: [] });
  });

  test('카테고리는 비워도 유효하다 — 미선택은 발송 시 기타로 저장된다(PO 2026-08-26)', () => {
    expect(
      validatePromiseDraft(
        {
          title: '주 3회 달리기',
          body: '매주 세 번 함께 달린다.',
          category: '',
          end_date: '2026-08-10',
          keeper: 'BOTH',
          reward: '',
          penalty: '',
          witness_enabled: false,
        },
        NOW,
      ),
    ).toEqual({ valid: true, fields: {}, invalidFields: [] });
  });

  test('한국 휴대전화와 구분자 포함 10~14자리 숫자열은 경고하되 검증을 막지 않는다', () => {
    expect(containsSensitiveNumber('연락은 010-1234-5678로 해줘')).toBe(true);
    expect(containsSensitiveNumber('계좌 123-456-789012')).toBe(true);
    expect(containsSensitiveNumber('오전 7시에 3km 달리기')).toBe(false);

    const result = validatePromiseDraft(
      {
        ...EMPTY_PROMISE_DRAFT,
        title: '연락 약속',
        body: '연락은 010-1234-5678로 해줘',
        category: 'ETC',
        end_date: '2026-08-10',
      },
      NOW,
    );
    expect(result.valid).toBe(true);
  });
});
