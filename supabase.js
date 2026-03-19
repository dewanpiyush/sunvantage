import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

export const SUPABASE_URL = 'https://drdrmwedttrzrtsipaei.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZHJtd2VkdHRyenJ0c2lwYWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDgzNzMsImV4cCI6MjA4NzU4NDM3M30.sgWIShBxaI3eLhTYct20-4JpS3A4f4wgQ1J_lTiNE4Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: AsyncStorage,
    detectSessionInUrl: false, // Required for React Native / Expo
  },
});

export default supabase;
