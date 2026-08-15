import type { NotificationInboxCursor, NotificationInboxItem } from '@littlefinger/shared';

type ReadOperation =
  | { status: 'PENDING' }
  | { status: 'SUCCEEDED'; completedRevision: number }
  | { status: 'FAILED'; completedRevision: number };

export interface NotificationInboxViewItem extends NotificationInboxItem {
  locallyRead: boolean;
}

export interface NotificationInboxState {
  items: readonly NotificationInboxViewItem[] | null;
  loadFailed: boolean;
  completionRevision: number;
  latestLoadId: number;
  nextCursor: NotificationInboxCursor | null;
  pageLoadPending: boolean;
  pageLoadFailed: boolean;
  pageStartedRevision: number | null;
  readOperations: Readonly<Record<string, ReadOperation>>;
  readAllPending: boolean;
  readAllSucceededRevision: number | null;
}

export const INITIAL_NOTIFICATION_INBOX_STATE: NotificationInboxState = {
  items: null,
  loadFailed: false,
  completionRevision: 0,
  latestLoadId: 0,
  nextCursor: null,
  pageLoadPending: false,
  pageLoadFailed: false,
  pageStartedRevision: null,
  readOperations: {},
  readAllPending: false,
  readAllSucceededRevision: null,
};

export type NotificationInboxAction =
  | { type: 'REFRESH_STARTED'; loadId: number }
  | {
      type: 'REFRESH_SUCCEEDED';
      loadId: number;
      items: readonly NotificationInboxItem[];
      nextCursor: NotificationInboxCursor | null;
      startedRevision: number;
    }
  | { type: 'REFRESH_FAILED'; loadId: number }
  | { type: 'PAGE_STARTED'; loadId: number }
  | {
      type: 'PAGE_SUCCEEDED';
      loadId: number;
      items: readonly NotificationInboxItem[];
      nextCursor: NotificationInboxCursor | null;
    }
  | { type: 'PAGE_FAILED'; loadId: number }
  | { type: 'READ_STARTED'; notificationId: string }
  | { type: 'READ_SUCCEEDED'; notificationId: string; readAt: string }
  | { type: 'READ_FAILED'; notificationId: string }
  | { type: 'READ_ALL_STARTED'; notificationIds: readonly string[] }
  | { type: 'READ_ALL_SUCCEEDED'; notificationIds: readonly string[] }
  | { type: 'READ_ALL_FAILED'; notificationIds: readonly string[] };

function readOperationsForRefresh(
  operations: Readonly<Record<string, ReadOperation>>,
  startedRevision: number,
): Readonly<Record<string, ReadOperation>> {
  return Object.fromEntries(
    Object.entries(operations).filter(([, operation]) =>
      operation.status === 'PENDING' || operation.completedRevision > startedRevision,
    ),
  );
}

function completeOperations(
  operations: Readonly<Record<string, ReadOperation>>,
  notificationIds: readonly string[],
  status: 'SUCCEEDED' | 'FAILED',
  completedRevision: number,
): Readonly<Record<string, ReadOperation>> {
  const next = { ...operations };
  notificationIds.forEach((notificationId) => {
    next[notificationId] = { status, completedRevision };
  });
  return next;
}

export function notificationInboxReducer(
  state: NotificationInboxState,
  action: NotificationInboxAction,
): NotificationInboxState {
  switch (action.type) {
    case 'REFRESH_STARTED':
      return {
        ...state,
        latestLoadId: action.loadId,
        loadFailed: false,
        nextCursor: null,
        pageLoadPending: false,
        pageLoadFailed: false,
      };
    case 'REFRESH_SUCCEEDED':
      if (action.loadId !== state.latestLoadId) return state;
      return {
        ...state,
        items: action.items.map((item) => ({ ...item, locallyRead: false })),
        nextCursor: action.nextCursor,
        loadFailed: false,
        readOperations: readOperationsForRefresh(
          state.readOperations,
          action.startedRevision,
        ),
      };
    case 'REFRESH_FAILED':
      if (action.loadId !== state.latestLoadId) return state;
      return { ...state, items: state.items ?? [], loadFailed: true };
    case 'PAGE_STARTED':
      if (action.loadId !== state.latestLoadId || state.pageLoadPending) return state;
      return {
        ...state,
        pageLoadPending: true,
        pageLoadFailed: false,
        pageStartedRevision: state.completionRevision,
      };
    case 'PAGE_SUCCEEDED': {
      if (action.loadId !== state.latestLoadId || !state.pageLoadPending) return state;
      const readAllFinishedAfterPageStarted =
        state.pageStartedRevision !== null &&
        state.readAllSucceededRevision !== null &&
        state.readAllSucceededRevision > state.pageStartedRevision;
      const knownIds = new Set((state.items ?? []).map((item) => item.notification_id));
      const appended = action.items
        .filter((item) => {
          if (knownIds.has(item.notification_id)) return false;
          knownIds.add(item.notification_id);
          return true;
        })
        .map((item) => ({
          ...item,
          locallyRead:
            state.readAllPending || readAllFinishedAfterPageStarted,
        }));
      return {
        ...state,
        items: [...(state.items ?? []), ...appended],
        nextCursor: action.nextCursor,
        pageLoadPending: false,
        pageLoadFailed: false,
        pageStartedRevision: null,
      };
    }
    case 'PAGE_FAILED':
      if (action.loadId !== state.latestLoadId || !state.pageLoadPending) return state;
      return {
        ...state,
        pageLoadPending: false,
        pageLoadFailed: true,
        pageStartedRevision: null,
      };
    case 'READ_STARTED':
      return {
        ...state,
        readOperations: {
          ...state.readOperations,
          [action.notificationId]: { status: 'PENDING' },
        },
      };
    case 'READ_SUCCEEDED': {
      const completedRevision = state.completionRevision + 1;
      return {
        ...state,
        completionRevision: completedRevision,
        items:
          state.items?.map((item) =>
            item.notification_id === action.notificationId
              ? { ...item, read_at: action.readAt, locallyRead: true }
              : item,
          ) ?? null,
        readOperations: completeOperations(
          state.readOperations,
          [action.notificationId],
          'SUCCEEDED',
          completedRevision,
        ),
      };
    }
    case 'READ_FAILED': {
      const completedRevision = state.completionRevision + 1;
      return {
        ...state,
        completionRevision: completedRevision,
        readOperations: completeOperations(
          state.readOperations,
          [action.notificationId],
          'FAILED',
          completedRevision,
        ),
      };
    }
    case 'READ_ALL_STARTED': {
      const next = { ...state.readOperations };
      action.notificationIds.forEach((notificationId) => {
        next[notificationId] = { status: 'PENDING' };
      });
      return { ...state, readOperations: next, readAllPending: true };
    }
    case 'READ_ALL_SUCCEEDED': {
      const completedRevision = state.completionRevision + 1;
      const completedIds = new Set([
        ...action.notificationIds,
        ...(state.items ?? []).map((item) => item.notification_id),
      ]);
      return {
        ...state,
        completionRevision: completedRevision,
        items:
          state.items?.map((item) => ({ ...item, locallyRead: true })) ?? null,
        readOperations: completeOperations(
          state.readOperations,
          [...completedIds],
          'SUCCEEDED',
          completedRevision,
        ),
        readAllPending: false,
        readAllSucceededRevision: completedRevision,
      };
    }
    case 'READ_ALL_FAILED': {
      const completedRevision = state.completionRevision + 1;
      return {
        ...state,
        completionRevision: completedRevision,
        readOperations: completeOperations(
          state.readOperations,
          action.notificationIds,
          'FAILED',
          completedRevision,
        ),
        readAllPending: false,
      };
    }
  }
}

export function isNotificationUnread(
  state: NotificationInboxState,
  item: NotificationInboxItem,
): boolean {
  const current = state.items?.find(
    (candidate) => candidate.notification_id === item.notification_id,
  );
  return (
    item.read_at === null &&
    current?.locallyRead !== true &&
    state.readOperations[item.notification_id] === undefined
  );
}

export function unreadNotificationIds(state: NotificationInboxState): readonly string[] {
  return (state.items ?? [])
    .filter((item) => isNotificationUnread(state, item))
    .map((item) => item.notification_id);
}
