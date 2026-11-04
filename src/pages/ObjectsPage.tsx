import { routes } from '../constants/routes';
import { UserRole } from '../types/domain';
import { useCallback, useState } from 'react';
import { Button, Card, List, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';

import { getObjects } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import type { ConstructionObject } from '../types/database';
import { DeleteButton } from '../components/DeleteButton';
import { ObjectEditor } from '../components/ObjectEditor';
import { ErrorPanel, Loading } from '../components/Feedback';

export function ObjectsPage() {
  const { profile } = useAuth();
  const manager = profile?.role === UserRole.Manager;
  const resource = useResource(useCallback(getObjects, []));
  const [editor, setEditor] = useState<ConstructionObject | 'create' | null>(null);

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Title level={1}>Объекты</Typography.Title>
          <p className="muted">
            {manager
              ? 'Строительные площадки и задачи команды'
              : 'Объекты с назначенными вам задачами'}
          </p>
        </div>
        <Space wrap>
          <Button
            onClick={() => void resource.refresh()}
            loading={resource.loading}
          >
            Обновить
          </Button>
          {manager ? (
            <Button type="primary" onClick={() => setEditor('create')}>
              Новый объект
            </Button>
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
      ) : (
        <List
          grid={{ gutter: 20, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
          dataSource={resource.data ?? []}
          rowKey="id"
          locale={{
            emptyText: manager
              ? 'Создайте первый объект'
              : 'Пока нет объектов с вашими задачами',
          }}
          pagination={
            (resource.data?.length ?? 0) > 18
              ? { pageSize: 18, showSizeChanger: false }
              : false
          }
          renderItem={object => (
            <List.Item>
              <Card className="object-card">
                <span className="eyebrow">Объект</span>
                <h2>
                  <Link to={routes.object.path(object.id)}>{object.name}</Link>
                </h2>
                <p className="address">{object.address || 'Адрес не указан'}</p>
                {manager ? (
                  <Space wrap>
                    <Button onClick={() => setEditor(object)}>Изменить</Button>
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
                      onRemoved={() => void resource.refresh()}
                    />
                  </Space>
                ) : (
                  <Link to={routes.object.path(object.id)}>Открыть задачи →</Link>
                )}
              </Card>
            </List.Item>
          )}
        />
      )}
      {editor && manager ? (
        <ObjectEditor
          object={editor === 'create' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void resource.refresh();
          }}
        />
      ) : null}
    </>
  );
}
