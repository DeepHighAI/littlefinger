import { useLocalSearchParams } from 'expo-router';
import { WitnessReview } from '../../components/WitnessReview.tsx';
export default function WitnessDetailScreen(): React.JSX.Element {
  const { promise_id } = useLocalSearchParams<{ promise_id: string }>();
  return <WitnessReview key={promise_id} promiseId={promise_id} />;
}
