import { UserRole } from '../types/domain';
import type {
  ConstructionObject,
  Identity,
  Profile,
  StatusHistory,
  Task,
} from '../types/database';

import { db } from './supabase';

// Read all authorized rows in bounded requests instead of silently trusting the API row cap.
type Page<T> = { data: T[] | null; error: unknown; count: number | null };

async function allRows<T>(
  read: (from: number, to: number) => PromiseLike<Page<T>>
): Promise<T[]> {
  const rows: T[] = [];

  for (;;) {
    const result = await read(rows.length, rows.length + 199);
    if (result.error) throw result.error;
    const batch = result.data ?? [];
    rows.push(...batch);
    if (
      batch.length === 0 ||
      (result.count !== null && rows.length >= result.count)
    )
      return rows;
  }
}

export const getObjects = () =>
  allRows<ConstructionObject>((from, to) =>
    db()
      .from('objects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
  );

export const getWorkers = () =>
  allRows<Profile>((from, to) =>
    db()
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('role', UserRole.Worker)
      .order('display_name')
      .order('id')
      .range(from, to)
  );

export const getTasks = (objectId?: string) =>
  allRows<Task>((from, to) => {
    let query = db().from('tasks').select('*', { count: 'exact' });
    if (objectId) query = query.eq('object_id', objectId);
    return query
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to);
  });

export async function getObject(id: string) {
  const { data, error } = await db()
    .from('objects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTaskDetail(id: string) {
  const { data: task, error } = await db()
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!task) return null;
  const [object, history, people] = await Promise.all([
    getObject(task.object_id),
    allRows<StatusHistory>((from, to) =>
      db()
        .from('task_status_history')
        .select('*', { count: 'exact' })
        .eq('task_id', id)
        .order('created_at')
        .order('id')
        .range(from, to)
    ),
    allRows<Identity>((from, to) =>
      db()
        .rpc('task_identities', { p_task_id: id }, { count: 'exact' })
        .order('id')
        .range(from, to)
    ),
  ]);

  if (!object) return null;

  return { task, object, history, people };
}
