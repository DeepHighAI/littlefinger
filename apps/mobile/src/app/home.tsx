import {
  PROMISE_STATUS_LABEL,
  type ParticipantPromiseSummary,
  type PromiseStatus,
} from '@littlefinger/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LfAppBar } from '../components/LfAppBar';
import { LfButton } from '../components/LfButton';
import { LfCard } from '../components/LfCard';
import { LfChip } from '../components/LfChip';
import { LfEmpty } from '../components/LfEmpty';
import { LfFab } from '../components/LfFab';
import { LfIcon } from '../components/LfIcon';
import { LfRow } from '../components/LfRow';
import { LfStack } from '../components/LfStack';
import { LfText } from '../components/LfText';
import {
  deleteDraft,
  listWaitingPromises,
  type WaitingPromiseSummary,
} from '../lib/home-promises-native.ts';
import { listParticipantPromises } from '../lib/fulfillment-native.ts';
import { SCR_A02_LABEL as HOME_LABEL } from '../screens/scr-a02-labels.ts';
import { colors, gutter, size, space } from '../theme/tokens';

const ACTIVE_STATUSES: readonly PromiseStatus[] = [
  'ACTIVE',
  'AMEND_PENDING',
  'CHECKING',
];
const COMPLETED_STATUSES: readonly PromiseStatus[] = [
  'COMPLETED',
  'BROKEN',
  'DISPUTED',
  'UNRESOLVED',
  'CANCELED',
  'DECLINED',
];
const FULFILLMENT_STATUSES: readonly PromiseStatus[] = [
  'CHECKING',
  'DISPUTED',
  'COMPLETED',
  'BROKEN',
  'UNRESOLVED',
];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    minHeight: size.tabHeight,
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceChrome,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  body: {
    flexGrow: 1,
    padding: gutter.app,
    paddingBottom: size.fabHeight + gutter.app + space[9],
  },
  list: { gap: space[5] },
  cardTitle: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notifications: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const [promises, setPromises] = useState<WaitingPromiseSummary[] | null>(null);
  const [participantPromises, setParticipantPromises] = useState<
    ParticipantPromiseSummary[] | null
  >(null);
  const [waitingLoadFailed, setWaitingLoadFailed] = useState(false);
  const [participantLoadFailed, setParticipantLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setWaitingLoadFailed(false);
    setParticipantLoadFailed(false);
    void listWaitingPromises()
      .then((rows) => {
        if (active) setPromises(rows);
      })
      .catch(() => {
        if (active) {
          setPromises([]);
          setWaitingLoadFailed(true);
        }
      });
    void listParticipantPromises()
      .then((rows) => {
        if (active) setParticipantPromises(rows);
      })
      .catch(() => {
        if (active) {
          setParticipantPromises([]);
          setParticipantLoadFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function removeDraft(promiseId: string): Promise<void> {
    try {
      await deleteDraft(promiseId);
      setPromises((rows) => rows?.filter((row) => row.id !== promiseId) ?? []);
    } catch {
      setWaitingLoadFailed(true);
    }
  }

  function confirmDelete(item: WaitingPromiseSummary): void {
    Alert.alert(HOME_LABEL.deleteFirstTitle, HOME_LABEL.deleteFirstBody, [
      { text: HOME_LABEL.cancel, style: 'cancel' },
      {
        text: HOME_LABEL.deleteContinue,
        onPress: () => {
          Alert.alert(HOME_LABEL.deleteFinalTitle, HOME_LABEL.deleteFinalBody, [
            { text: HOME_LABEL.cancel, style: 'cancel' },
            {
              text: HOME_LABEL.delete,
              style: 'destructive',
              onPress: async () => await removeDraft(item.id),
            },
          ]);
        },
      },
    ]);
  }

  function openPromise(item: WaitingPromiseSummary): void {
    if (item.status === 'DRAFT') {
      router.push({ pathname: '/promise/edit', params: { promise_id: item.id } });
    } else {
      router.push({ pathname: '/invite', params: { promise_id: item.id } });
    }
  }

  const waitingCount = promises?.length ?? 0;
  const activeCount =
    participantPromises?.filter((item) => ACTIVE_STATUSES.includes(item.status))
      .length ?? 0;
  const completedCount =
    participantPromises?.filter((item) => COMPLETED_STATUSES.includes(item.status))
      .length ?? 0;
  const sortedParticipantPromises = [...(participantPromises ?? [])].sort(
    (left, right) => {
      if (left.needs_response !== right.needs_response) {
        return left.needs_response ? -1 : 1;
      }
      return Date.parse(right.updated_at) - Date.parse(left.updated_at);
    },
  );
  const loading = promises === null && participantPromises === null;
  const empty =
    promises?.length === 0 &&
    participantPromises?.length === 0 &&
    !waitingLoadFailed &&
    !participantLoadFailed;

  function participantCard(item: ParticipantPromiseSummary): React.JSX.Element {
    const card = (
      <LfCard variant={item.needs_response ? 'emphasis' : 'default'}>
        <LfStack gap={4}>
          <LfChip label={PROMISE_STATUS_LABEL[item.status]} tone="status" />
          <View style={styles.cardTitle}>
            <LfText variant="subtitle">{item.title}</LfText>
          </View>
        </LfStack>
      </LfCard>
    );
    const actionable = FULFILLMENT_STATUSES.includes(item.status);
    return actionable ? (
      <Pressable
        key={item.promise_id}
        testID={`participant-promise-${item.promise_id}`}
        accessibilityRole="button"
        accessibilityLabel={HOME_LABEL.open(item.title)}
        onPress={() =>
          router.push({
            pathname: '/fulfillment/[promise_id]',
            params: { promise_id: item.promise_id },
          })
        }
      >
        {card}
      </Pressable>
    ) : (
      <View
        key={item.promise_id}
        testID={`participant-promise-${item.promise_id}`}
      >
        {card}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LfAppBar
        brand
        title={HOME_LABEL.brand}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={HOME_LABEL.notifications}
            onPress={() => router.push('/notifications' as never)}
            style={styles.notifications}
          >
            <LfIcon name="notifications-none" />
          </Pressable>
        }
      />
      <View style={styles.tabs} accessibilityRole="tablist">
        <LfText variant="caption">{HOME_LABEL.activeTab(activeCount)}</LfText>
        <LfText variant="caption">{HOME_LABEL.waitingTab(waitingCount)}</LfText>
        <LfText variant="caption">
          {HOME_LABEL.completedTab(completedCount)}
        </LfText>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <LfText secondary>{HOME_LABEL.loading}</LfText>
        </View>
      ) : empty ? (
        <LfEmpty title={HOME_LABEL.empty} description={HOME_LABEL.emptyDescription} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.list}>
            {participantLoadFailed && (
              <LfText secondary align="center">
                {HOME_LABEL.participantLoadError}
              </LfText>
            )}
            {waitingLoadFailed && (
              <LfText secondary align="center">
                {HOME_LABEL.loadError}
              </LfText>
            )}
            {sortedParticipantPromises.map(participantCard)}
            {(promises ?? []).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={HOME_LABEL.open(item.title)}
                onPress={() => openPromise(item)}
              >
                <LfCard>
                  <LfStack gap={4}>
                    <LfChip label={PROMISE_STATUS_LABEL[item.status]} tone="status" />
                    <LfRow gap={4}>
                      <View style={styles.cardTitle}>
                        <LfText variant="subtitle">{item.title}</LfText>
                      </View>
                      {item.status === 'DRAFT' && (
                        <LfButton
                          variant="text"
                          size="compact"
                          label={HOME_LABEL.delete}
                          accessibilityLabel={HOME_LABEL.deleteDraft(item.title)}
                          onPress={() => confirmDelete(item)}
                        />
                      )}
                    </LfRow>
                  </LfStack>
                </LfCard>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <LfFab label={HOME_LABEL.create} onPress={() => router.push('/promise/edit')} />
    </SafeAreaView>
  );
}
