import { TaskStatus } from '../types/domain';

export const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.New]: 'Новая',
  [TaskStatus.InProgress]: 'В работе',
  [TaskStatus.InReview]: 'На проверке',
  [TaskStatus.Accepted]: 'Принята',
  [TaskStatus.Revision]: 'На доработке',
};

export const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.New]: 'default',
  [TaskStatus.InProgress]: 'blue',
  [TaskStatus.InReview]: 'gold',
  [TaskStatus.Accepted]: 'green',
  [TaskStatus.Revision]: 'volcano',
};

export const statusOptions = Object.values(TaskStatus).map(
  value => ({ value, label: statusLabels[value] })
);

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
