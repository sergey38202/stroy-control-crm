export enum UserRole {
  Manager = 'manager',
  Worker = 'worker',
}

export enum TaskStatus {
  New = 'new',
  InProgress = 'in_progress',
  InReview = 'in_review',
  Accepted = 'accepted',
  Revision = 'revision',
}

export type Role = UserRole;

export const roleLabels: Record<UserRole, string> = {
  [UserRole.Manager]: 'Постановщик',
  [UserRole.Worker]: 'Исполнитель',
};
