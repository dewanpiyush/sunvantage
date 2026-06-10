import { Redirect } from 'expo-router';

/** Legacy route — Vantage Walk is now Vantage Hunt. */
export default function VantageWalkRedirect() {
  return <Redirect href="/vantage-hunt" />;
}
