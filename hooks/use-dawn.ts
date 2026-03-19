import { useAppTheme } from '@/context/AppThemeContext';

export function useDawn() {
  const { dawn } = useAppTheme();
  return dawn;
}

