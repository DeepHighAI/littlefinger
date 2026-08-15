import type { NotificationInboxItem } from '@littlefinger/shared';

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
  readOperations: Readonly<Record<string, ReadOperation>>;
  readAllPending: boolean;
}

export const INITIAL_NOTIFICATION_INBOX_STATE: NotificationInboxState = {
  items: null,
  loadFailed: false,
  completionRevision: 0,
  readOperations: {},
  readAllPending: false,
};

export type NotificationInboxAction =
  | { type: 'REFRESH_STARTED' }
  | {
      type: 'REFRESH_SUCCEEDED';
      items: readonly NotificationInboxItem[];
      startedRevision: number;
    }
  | { type: 'REFRESH_FAILED' }
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
      return { ...state, loadFailed: false };
    case 'REFRESH_SUCCEEDED':
      return {
        ...state,
        items: action.items.map((item) => ({ ...item, locallyRead: false })),
        loadFailed: false,
        readOperations: readOperationsForRefresh(
          state.readOperations,
          action.startedRevision,
        ),
      };
    case 'REFRESH_FAILED':
      return { ...state, items: state.items ?? [], loadFailed: true };
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
      const completedIds = new Set(action.notificationIds);
      return {
        ...state,
        completionRevision: completedRevision,
        items:
          state.items?.map((item) =>
            completedIds.has(item.notification_id) ? { ...item, locallyRead: true } : item,
          ) ?? null,
        readOperations: completeOperations(
          state.readOperations,
          action.notificationIds,
          'SUCCEEDED',
          completedRevision,
        ),
        readAllPending: false,
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
