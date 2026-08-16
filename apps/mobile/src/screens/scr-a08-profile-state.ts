import type {
  ReminderPreferences,
  TrustProfileDetailResponse,
  TrustProfileSettingsUpdateResponse,
} from '@littlefinger/shared';

export interface ProfileState {
  profile: TrustProfileDetailResponse | null;
  confirmedReminders: ReminderPreferences | null;
  displayedReminders: ReminderPreferences | null;
  latestLoadId: number;
  pendingUpdateId: number | null;
  loading: boolean;
  saving: boolean;
  loggingOut: boolean;
  loadFailed: boolean;
  saveFailed: boolean;
  logoutFailed: boolean;
}

export type ProfileAction =
  | { type: 'LOAD_STARTED'; loadId: number }
  | { type: 'LOAD_SUCCEEDED'; loadId: number; profile: TrustProfileDetailResponse }
  | { type: 'LOAD_FAILED'; loadId: number }
  | { type: 'UPDATE_STARTED'; updateId: number; reminders: ReminderPreferences }
  | { type: 'UPDATE_SUCCEEDED'; updateId: number; response: TrustProfileSettingsUpdateResponse }
  | { type: 'UPDATE_FAILED'; updateId: number }
  | { type: 'LOGOUT_STARTED' }
  | { type: 'LOGOUT_FAILED' };

export function createInitialProfileState(): ProfileState {
  return {
    profile: null,
    confirmedReminders: null,
    displayedReminders: null,
    latestLoadId: 0,
    pendingUpdateId: null,
    loading: false,
    saving: false,
    loggingOut: false,
    loadFailed: false,
    saveFailed: false,
    logoutFailed: false,
  };
}

export function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  if (action.type === 'LOAD_STARTED') {
    return { ...state, latestLoadId: action.loadId, loading: true, loadFailed: false };
  }
  if (action.type === 'LOAD_SUCCEEDED') {
    if (action.loadId !== state.latestLoadId) return state;
    return {
      ...state,
      profile: action.profile,
      confirmedReminders: action.profile.reminders,
      displayedReminders: action.profile.reminders,
      loading: false,
      loadFailed: false,
    };
  }
  if (action.type === 'LOAD_FAILED') {
    return action.loadId === state.latestLoadId
      ? { ...state, loading: false, loadFailed: true }
      : state;
  }
  if (action.type === 'UPDATE_STARTED') {
    return {
      ...state,
      pendingUpdateId: action.updateId,
      displayedReminders: action.reminders,
      saving: true,
      saveFailed: false,
    };
  }
  if (action.type === 'UPDATE_SUCCEEDED') {
    if (action.updateId !== state.pendingUpdateId) return state;
    return {
      ...state,
      profile: state.profile === null
        ? null
        : { ...state.profile, reminders: action.response.reminders, updated_at: action.response.updated_at },
      confirmedReminders: action.response.reminders,
      displayedReminders: action.response.reminders,
      pendingUpdateId: null,
      saving: false,
      saveFailed: false,
    };
  }
  if (action.type === 'UPDATE_FAILED') {
    if (action.updateId !== state.pendingUpdateId) return state;
    return {
      ...state,
      displayedReminders: state.confirmedReminders,
      pendingUpdateId: null,
      saving: false,
      saveFailed: true,
    };
  }
  if (action.type === 'LOGOUT_STARTED') {
    return { ...state, loggingOut: true, logoutFailed: false };
  }
  return { ...state, loggingOut: false, logoutFailed: true };
}
