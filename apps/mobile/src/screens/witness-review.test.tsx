import { act, fireEvent, render } from '@testing-library/react-native';
import { ENDPOINT, type WitnessDetailResponse } from '@littlefinger/shared';
import { WitnessReview } from '../components/WitnessReview.tsx';
import { callMobileFunctionNative, callMobileFunctionPublicNative } from '../lib/mobile-api-native.ts';
jest.mock('../lib/mobile-api-native.ts', () => ({ callMobileFunctionNative: jest.fn(), callMobileFunctionPublicNative: jest.fn() }));
jest.mock('../lib/invite-review-native.ts', () => ({ createInviteReviewIdempotencyKey: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
const call = jest.mocked(callMobileFunctionNative); const decline = jest.mocked(callMobileFunctionPublicNative);
const id='11111111-1111-4111-8111-111111111111';
const detail: WitnessDetailResponse = { promise_id:id, status:'ACTIVE', visibility:'FULL', title:'매일 걷기', creator:{user_id:id,nickname:'지우',profile_image_url:null}, partner:{user_id:id,nickname:'민수',profile_image_url:null},activated_at:'2026-09-01T00:00:00Z',signed_at:null,content:{body:'매일 30분 걷기',category:'HABIT',end_date:null,keeper:'BOTH',reward:'커피',penalty:'설거지'},fulfillment:null };
beforeEach(() => { jest.clearAllMocks(); call.mockImplementation(async endpoint => {
  if(endpoint===ENDPOINT.witnessJoin) return {promise_id:id,participant_id:id,status:'JOINED'};
  if(endpoint===ENDPOINT.witnessSign) return {promise_id:id,signed_at:'2026-09-15T00:00:00Z'};
  return detail;
}); });
async function settle() { await act(async()=>{await Promise.resolve();await Promise.resolve();}); }
test('preview is read-only; join and sign follow explicit content confirmation', async()=>{
  const view=await render(<WitnessReview token="invite-token" />); await settle();
  expect(view.getByText('매일 30분 걷기')).toBeTruthy();
  expect(call.mock.calls.map(c=>c[0])).toEqual([ENDPOINT.witnessPreview]);
  await fireEvent.press(view.getByRole('button',{name:'내용을 확인했습니다'})); await settle();
  expect(call.mock.calls.map(c=>c[0])).toContain(ENDPOINT.witnessJoin);
  expect(call.mock.calls.map(c=>c[0])).toContain(ENDPOINT.witnessSign);
});
test('unconfirmed promise joins only after a tap and never signs hidden content',async()=>{
  call.mockImplementation(async endpoint=>endpoint===ENDPOINT.witnessJoin ? {promise_id:id,participant_id:id,status:'JOINED'} : {...detail,visibility:'LIMITED',partner:null,activated_at:null,content:null});
  const view=await render(<WitnessReview token="invite-token" />); await settle();
  expect(view.queryByText('매일 30분 걷기')).toBeNull();
  await fireEvent.press(view.getByRole('button',{name:'증인으로 참여하기'})); await settle();
  expect(call.mock.calls.some(c=>c[0]===ENDPOINT.witnessSign)).toBe(false);
});
test('decline needs confirmation and never joins the witness',async()=>{
  decline.mockResolvedValue({status:'DECLINED',target_role:'WITNESS'});
  const view=await render(<WitnessReview token="invite-token" />); await settle();
  await fireEvent.press(view.getByRole('button',{name:'거절하기'})); expect(decline).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button',{name:'거절하기'})); await settle();
  expect(view.getByText('초대를 거절했어요')).toBeTruthy();
  expect(call.mock.calls.some(c=>c[0]===ENDPOINT.witnessJoin)).toBe(false);
});


test('failed signature retries without joining again', async () => {
  let attempts = 0;
  call.mockImplementation(async endpoint => {
    if (endpoint === ENDPOINT.witnessJoin) return {promise_id: id, participant_id: id, status: 'JOINED'};
    if (endpoint === ENDPOINT.witnessSign) {
      if (++attempts === 1) throw new Error('NETWORK');
      return {promise_id: id, signed_at: '2026-09-15T00:00:00Z'};
    }
    return detail;
  });
  const view = await render(<WitnessReview token="invite-token" />); await settle();
  await fireEvent.press(view.getByRole('button', {name: '내용을 확인했습니다'})); await settle();
  await fireEvent.press(view.getByRole('button', {name: '내용을 확인했습니다'})); await settle();
  expect(call.mock.calls.filter(c => c[0] === ENDPOINT.witnessJoin)).toHaveLength(1);
  expect(call.mock.calls.filter(c => c[0] === ENDPOINT.witnessSign)).toHaveLength(2);
});

test('existing witnesses leave only after confirmation', async () => {
  call.mockImplementation(async endpoint => endpoint === ENDPOINT.witnessLeave
    ? {promise_id: id, status: 'WITHDRAWN'} : {...detail, signed_at: '2026-09-15T00:00:00Z'});
  const view = await render(<WitnessReview promiseId={id} />); await settle();
  await fireEvent.press(view.getByRole('button', {name: '증인 나가기'}));
  expect(call.mock.calls.some(c => c[0] === ENDPOINT.witnessLeave)).toBe(false);
  await fireEvent.press(view.getByRole('button', {name: '증인 나가기'})); await settle();
  expect(call.mock.calls.filter(c => c[0] === ENDPOINT.witnessLeave)).toHaveLength(1);
  expect(view.queryByRole('button', {name: '약속 보기'})).toBeNull();
});
