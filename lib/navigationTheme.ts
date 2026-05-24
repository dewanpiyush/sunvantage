import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { MorningLight, NightCalm } from '@/constants/theme';

/** Navigation surfaces stay transparent so `AppBackground` gradient is continuous. */
export const SunVantageDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: NightCalm.accent.sunrise,
    background: 'transparent',
    card: 'transparent',
    border: NightCalm.border.subtle,
    text: NightCalm.text.primary,
  },
};

export const SunVantageLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: MorningLight.accent.sunrise,
    background: 'transparent',
    card: 'transparent',
    border: MorningLight.border.subtle,
    text: MorningLight.text.primary,
  },
};
