import { routes } from '../constants/routes';
import { UserRole } from '../types/domain';
import { useCallback, useState } from 'react';
import { Breadcrumb, Button, Card, Space, Typography } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getObject, getTasks } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import type { ConstructionObject, Task } from '../types/database';
import { DeleteButton } from '../components/DeleteButton';
import { ObjectEditor } from '../components/ObjectEditor';
import { TaskEditor } from '../components/TaskEditor';
import { TaskList } from '../components/TaskList';
import { ErrorPanel, Loading, Unavailable } from '../components/Feedback';

export function ObjectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const manager = profile?.role === UserRole.Manager;
  const [editing, setEditing] = useState<ConstructionObject | null>(null);
  const [taskEditor, setTaskEditor] = useState<Task | 'create' | null>(null);

  const resource = useResource(
    useCallback(async () => {
      const [object, tasks] = await Promise.all([getObject(id), getTasks(id)]);
      return object ? { object, tasks } : null;
    }, [id])
  );

  const object = resource.data?.object;

  return (
    <>
      <Breadcrumb
        items={[
          { title: <Link to={routes.objects}>Объекты</Link> },
          { title: 'Карточка объекта' },
        ]}
      />
      <div className="page-heading">
        <div>
          <Typography.Title level={1}>
            {object?.name ?? 'Объект'}
          </Typography.Title>
          {object ? (
            <p className="address">{object.address || 'Адрес не указан'}</p>
          ) : null}
        </div>
        <Space wrap>
          <Button
            onClick={() => void resource.refresh()}
            loading={resource.loading}
          >
            Обновить
          </Button>
          {manager && object ? (
            <>
              <Button onClick={() => setEditing(object)}>
                Изменить объект
              </Button>
              <DeleteButton
                kind="object"
                name={object.name}
                remove={async () => {
                  const { error } = await db().rpc('delete_object', {
                    p_object_id: object.id,
                    p_expected_updated_at: object.updated_at,
                  });
                  if (error) throw error;
                }}
                onRemoved={() => navigate(routes.objects, { replace: true })}
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
      ) : !resource.data ? (
        <Unavailable />
      ) : (
        <Card
          title={manager ? 'Задачи объекта' : 'Мои задачи на объекте'}
          extra={
            manager ? (
              <Button type="primary" onClick={() => setTaskEditor('create')}>
                Новая задача
              </Button>
            ) : null
          }
        >
          <TaskList
            tasks={resource.data.tasks}
            onEdit={manager ? task => setTaskEditor(task) : undefined}
          />
        </Card>
      )}
      {editing && manager ? (
        <ObjectEditor
          object={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void resource.refresh();
          }}
        />
      ) : null}
      {taskEditor && manager ? (
        <TaskEditor
          objectId={id}
          task={taskEditor === 'create' ? undefined : taskEditor}
          onClose={() => setTaskEditor(null)}
          onSaved={() => {
            setTaskEditor(null);
            void resource.refresh();
          }}
        />
      ) : null}
    </>
  );
}
