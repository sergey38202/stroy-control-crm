import { routes } from '../constants/routes';
import { TaskStatus, UserRole } from '../types/domain';
import { useCallback, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getTaskDetail } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { formatDate, statusColors, statusLabels } from '../lib/status';
import type { Task } from '../types/database';
import { DeleteButton } from '../components/DeleteButton';
import { TaskEditor } from '../components/TaskEditor';
import { StatusActions } from '../components/StatusActions';
import { ErrorPanel, Loading, Unavailable } from '../components/Feedback';

export function TaskPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [editing, setEditing] = useState<Task | null>(null);
  const resource = useResource(useCallback(() => getTaskDetail(id), [id]));

  const detail = resource.data;
  const task = detail?.task;
  const people = new Map(
    detail?.people.map(person => [person.id, person.display_name]) ?? []
  );
  const personName = (personId: string) => people.get(personId) ?? 'Участник';

  return (
    <>
      <Breadcrumb
        items={[
          { title: <Link to={routes.objects}>Объекты</Link> },
          ...(detail
            ? [
                {
                  title: (
                    <Link to={routes.object.path(detail.object.id)}>
                      {detail.object.name}
                    </Link>
                  ),
                },
              ]
            : []),
          { title: 'Задача' },
        ]}
      />
      <div className="page-heading">
        <div>
          <Typography.Title level={1}>
            {task?.title ?? 'Задача'}
          </Typography.Title>
          {task ? (
            <Tag color={statusColors[task.status]}>
              {statusLabels[task.status]}
            </Tag>
          ) : null}
        </div>
        <Space wrap>
          <Button
            onClick={() => void resource.refresh()}
            loading={resource.loading}
          >
            Обновить
          </Button>
          {profile?.role === UserRole.Manager && task ? (
            <>
              <Button onClick={() => setEditing(task)}>Изменить</Button>
              <DeleteButton
                kind="task"
                name={task.title}
                remove={async () => {
                  const { error } = await db().rpc('delete_task', {
                    p_task_id: task.id,
                    p_expected_updated_at: task.updated_at,
                  });
                  if (error) throw error;
                }}
                onRemoved={() =>
                  navigate(routes.object.path(task.object_id), { replace: true })
                }
              />
            </>
          ) : null}
        </Space>
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorPanel
          error={resource.error}
          retry={() => void resource.refresh()}
        />
      ) : !detail || !profile ? (
        <Unavailable />
      ) : (
        <div className="detail-grid">
          <Card title="О задаче">
            <p className="description">
              {detail.task.description || 'Описание не добавлено'}
            </p>
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'object',
                  label: 'Объект',
                  children: (
                    <Link to={routes.object.path(detail.object.id)}>
                      {detail.object.name}
                    </Link>
                  ),
                },
                {
                  key: 'assignee',
                  label: 'Исполнитель',
                  children: personName(detail.task.assignee_id),
                },
                {
                  key: 'author',
                  label: 'Постановщик',
                  children: personName(detail.task.author_id),
                },
                {
                  key: 'created',
                  label: 'Создана',
                  children: formatDate(detail.task.created_at),
                },
              ]}
            />
            <div className="status-actions">
              <StatusActions
                key={`${detail.task.id}:${detail.task.updated_at}`}
                task={detail.task}
                profile={profile}
                onChanged={() => void resource.refresh()}
              />
            </div>
            {detail.task.status === TaskStatus.Accepted ? (
              <p className="muted">
                Работа принята. Изменение статуса завершено.
              </p>
            ) : null}
          </Card>
          <Card title="История статусов">
            <Timeline
              items={detail.history.map(entry => ({
                key: entry.id,
                color: entry.to_status === TaskStatus.Accepted ? 'green' : 'blue',
                children: (
                  <div>
                    <strong>
                      {entry.from_status
                        ? statusLabels[entry.from_status]
                        : 'Создание'}{' '}
                      → {statusLabels[entry.to_status]}
                    </strong>
                    <div className="muted">
                      {personName(entry.actor_id)} ·{' '}
                      {formatDate(entry.created_at)}
                    </div>
                    {entry.comment ? (
                      <p className="history-comment">{entry.comment}</p>
                    ) : null}
                  </div>
                ),
              }))}
            />
            <p className="muted">
              История формируется автоматически. Она удаляется вместе с задачей
              или объектом.
            </p>
          </Card>
        </div>
      )}
      {editing && profile?.role === UserRole.Manager ? (
        <TaskEditor
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void resource.refresh();
          }}
        />
      ) : null}
    </>
  );
}
