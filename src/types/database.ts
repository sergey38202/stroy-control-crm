import type { Role, TaskStatus, UserRole } from './domain';

export type { Role, TaskStatus } from './domain';

export type Profile = { id: string; display_name: string; role: Role };

export type ConstructionObject = {
  id: string;
  name: string;
  address: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  object_id: string;
  assignee_id: string;
  assignee_role: UserRole.Worker;
  status: TaskStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type StatusHistory = {
  id: number;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  actor_id: string;
  created_at: string;
  comment: string | null;
};

export type Identity = { id: string; display_name: string };

type ReadOnlyTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

type Rpc<Args, Returns = undefined> = { Args: Args; Returns: Returns };

export type Database = {
  public: {
    Tables: {
      profiles: ReadOnlyTable<Profile>;
      objects: ReadOnlyTable<ConstructionObject>;
      tasks: ReadOnlyTable<Task>;
      task_status_history: ReadOnlyTable<StatusHistory>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_object: Rpc<{ p_name: string; p_address: string }, string>;
      update_object: Rpc<{
        p_object_id: string;
        p_name: string;
        p_address: string;
        p_expected_updated_at: string;
      }>;
      delete_object: Rpc<{
        p_object_id: string;
        p_expected_updated_at: string;
      }>;
      create_task: Rpc<
        {
          p_title: string;
          p_description: string;
          p_object_id: string;
          p_assignee_id: string;
        },
        string
      >;
      update_task: Rpc<{
        p_task_id: string;
        p_title: string;
        p_description: string;
        p_object_id: string;
        p_assignee_id: string;
        p_expected_updated_at: string;
      }>;
      delete_task: Rpc<{ p_task_id: string; p_expected_updated_at: string }>;
      change_task_status: Rpc<{
        p_task_id: string;
        p_to_status: TaskStatus;
        p_expected_updated_at: string;
        p_comment: string | null;
      }>;
      task_identities: Rpc<{ p_task_id: string }, Identity[]>;
    };
    Enums: { app_role: Role; task_status: TaskStatus };
    CompositeTypes: { [_ in never]: never };
  };
};
