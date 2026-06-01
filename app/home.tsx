import { Redirect } from 'expo-router';
import { ROUTES } from '@/lib/routes';

/** Legacy route — Today tab is the new home. */
export default function HomeRedirect() {
  return <Redirect href={ROUTES.today as never} />;
}
