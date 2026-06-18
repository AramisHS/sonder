import { supabase } from './supabase';

export async function logAudit(
  userId: string,
  action: string,
  tableName: string,
  recordId?: string,
  oldData?: unknown,
  newData?: unknown
) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId ?? null,
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}
