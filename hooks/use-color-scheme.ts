import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAppTheme } from '@/context/AppThemeContext';

/**
 * App color scheme.
 * - If user selected an appearance mode, it wins.
 * - Falls back to OS color scheme if provider isn't mounted (rare).
 */
export function useColorScheme() {
  const { colorScheme } = useAppTheme();
  const rn = useRNColorScheme();
  return colorScheme ?? rn ?? 'light';
}
