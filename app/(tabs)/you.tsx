import React, { useCallback, useEffect, useState } from 'react';
import NavHubScreen from '@/components/NavHubScreen';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'expo-router';
import supabase from '@/supabase';
import { useMorningContext } from '@/hooks/useMorningContext';

export default function YouHubScreen() {
  const router = useRouter();
  const [city, setCity] = useState<string | null>(null);
  const { sunriseTomorrow } = useMorningContext(city);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || cancelled) return;
      const { data } = await supabase.from('profiles').select('city').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      const profileCity =
        data && typeof (data as { city?: string }).city === 'string'
          ? (data as { city: string }).city.trim() || null
          : null;
      setCity(profileCity);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = useCallback(async () => {
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
      showDawnInvitation
      dawnInvitationCity={city}
      dawnInvitationSunriseTomorrow={sunriseTomorrow}
      signOutLabel="Sign out"
      onSignOut={handleSignOut}
    />
  );
}
