-- ADMINISTRATOR ONLY. Not an application RPC and not a schema migration.
-- Create and confirm Auth users manually first. Replace ALL placeholder strings.
-- Run in Supabase SQL Editor as the administrator. Never place passwords here.
-- Placeholders deliberately are not valid UUIDs: this example fails until edited.
begin;

insert into public.profiles(id, display_name, role) values
  ('REPLACE_WITH_MANAGER_AUTH_USER_UUID'::uuid, 'Анна · Постановщик', 'manager'),
  ('REPLACE_WITH_FIRST_WORKER_AUTH_USER_UUID'::uuid, 'Иван · Исполнитель', 'worker'),
  ('REPLACE_WITH_SECOND_WORKER_AUTH_USER_UUID'::uuid, 'Мария · Исполнитель', 'worker');

commit;

-- Assigned workers cannot become managers while tasks reference them:
-- first reassign their tasks through the application. History and authors
-- reference profiles with RESTRICT: do not delete referenced profiles/Auth users.
