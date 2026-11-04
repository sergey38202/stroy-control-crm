import { UserRole } from '../types/domain';
import { useCallback, useState } from 'react';
import { Button, Card, Select, Space, Typography } from 'antd';

import { getObjects, getTasks } from '../lib/api';
import { useResource } from '../lib/useResource';
import { statusOptions } from '../lib/status';
import type { TaskStatus } from '../types/database';
import { TaskList } from '../components/TaskList';
import { ErrorPanel, Loading } from '../components/Feedback';
import { useAuth } from '../lib/auth';

export function MyTasksPage() {
  const [status, setStatus] = useState<TaskStatus>();
  const { profile } = useAuth();

  const resource = useResource(
    useCallback(async () => {
      const [tasks, objects] = await Promise.all([getTasks(), getObjects()]);
      return { tasks, objects };
    }, [])
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Title level={1}>
            {profile?.role === UserRole.Manager ? 'Все задачи' : 'Мои задачи'}
          </Typography.Title>
          <p className="muted">
            {profile?.role === UserRole.Manager
              ? 'Задачи команды на всех объектах'
              : 'Назначенные вам работы и их текущие статусы'}
          </p>
        </div>
        <Space wrap>
          <Select<TaskStatus>
            aria-label="Фильтр по статусу"
            placeholder="Все статусы"
            allowClear
            className="status-filter"
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
          <Button
            onClick={() => void resource.refresh()}
            loading={resource.loading}
          >
            Обновить
          </Button>
        </Space>
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorPanel
          error={resource.error}
          retry={() => void resource.refresh()}
        />
      ) : (
        <Card>
          <TaskList
            key={status ?? 'all'}
            tasks={
              resource.data?.tasks.filter(
                task => !status || task.status === status
              ) ?? []
            }
            objects={resource.data?.objects}
          />
        </Card>
      )}
    </>
  );
}
