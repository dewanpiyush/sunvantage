import { Redirect } from 'expo-router';
import { ROUTES } from '@/lib/routes';

/** Legacy route — Plan Tomorrow lives on the Tomorrow tab. */
export default function TomorrowPlanRedirect() {
  return <Redirect href={ROUTES.tomorrow as never} />;
}
