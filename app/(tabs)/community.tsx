import React from 'react';
import NavHubScreen from '@/components/NavHubScreen';
import { ROUTES } from '@/lib/routes';

export default function CommunityHubScreen() {
  return (
    <NavHubScreen
      title="Community"
      subtitle="Shared mornings from around the world."
      items={[
        {
          emoji: '🌍',
          title: 'Global Sunrise Map',
          subtitle: 'See where morning has arrived today.',
          route: ROUTES.globalMap,
        },
        {
          emoji: '🖼️',
          title: 'World Sunrise Gallery',
          subtitle: 'Quiet glimpses from other mornings.',
          route: ROUTES.worldGallery,
        },
        {
          emoji: '🌇',
          title: 'City Gallery',
          subtitle: 'Sunrises welcomed in your city.',
          route: ROUTES.cityGallery,
        },
        {
          emoji: '✨',
          title: 'Morning Fragments',
          subtitle: 'Small notes left in the light.',
          route: ROUTES.morningFragments,
        },
      ]}
    />
  );
}
