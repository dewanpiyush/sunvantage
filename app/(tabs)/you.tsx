import React from 'react';
import NavHubScreen from '@/components/NavHubScreen';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'expo-router';
import supabase from '@/supabase';

export default function YouHubScreen() {
  const router = useRouter();

  const handleSignOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/auth' as never);
  }, [router]);

  return (
    <NavHubScreen
      title="You"
      items={[
        {
          emoji: '📷',
          title: 'My Mornings',
          subtitle: 'Your archive of sunrises.',
          route: ROUTES.myMornings,
        },
        {
          emoji: '👤',
          title: 'Profile',
          subtitle: 'Your profile and journey.',
          route: ROUTES.profile,
        },
        {
          emoji: '✨',
          title: 'Ritual Markers',
          subtitle: 'Markers from your mornings.',
          route: ROUTES.ritualMarkers,
        },
      ]}
      showAppearanceToggle
      signOutLabel="Sign out"
      onSignOut={handleSignOut}
    />
  );
}
