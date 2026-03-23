/** Invoke moderate-image via Supabase client with debug logging. */

import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY } from '../supabase';

type ModerateBody =
  | { path: string; type: 'sunrise'; logId: number }
  | { path: string; type: 'avatar' };

export async function invokeModerateImage(supabase: SupabaseClient, body: ModerateBody) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  console.log('SESSION TOKEN START:', session?.access_token?.slice(0, 20));

  console.log('Invoking moderation', {
    logId: body.type === 'sunrise' ? body.logId : null,
    path: body.path,
    hasSession: !!session?.access_token,
  });

  const path = body.path;
  const type = body.type;
  const logId = body.type === 'sunrise' ? body.logId : undefined;

  const { data, error } = await supabase.functions.invoke(
    'moderate-image',
    {
      body: {
        path,
        type,
        logId,
      },
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );

  if (error) {
    console.log('❌ RAW ERROR OBJECT:', error);

    if (error instanceof FunctionsHttpError) {
      try {
        const errBody = await error.context.json();
        console.log('❌ FUNCTION ERROR BODY:', errBody);
      } catch (e) {
        console.log('❌ FAILED TO PARSE ERROR BODY');
      }
    }

    return { data: null, error };
  }
  return { data, error };
}
