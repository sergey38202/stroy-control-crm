import { routes } from '../constants/routes';
import { Button, List, Space, Tag } from 'antd';
import { Link } from 'react-router-dom';

import type { ConstructionObject, Task } from '../types/database';
import { formatDate, statusColors, statusLabels } from '../lib/status';

interface ITaskListProps {
  tasks: Task[];
  objects?: ConstructionObject[];
  onEdit?: (task: Task) => void;
}

export function TaskList({ tasks, objects = [], onEdit }: ITaskListProps) {
  const names = new Map(objects.map(object => [object.id, object.name]));

  return (
    <List
      dataSource={tasks}
      rowKey="id"
      locale={{ emptyText: 'Пока нет доступных задач' }}
      pagination={
        tasks.length > 20 ? { pageSize: 20, showSizeChanger: false } : false
      }
      renderItem={task => (
        <List.Item>
          <div className="task-row">
            <div>
              <Link className="record-title" to={routes.task.path(task.id)}>
                {task.title}
              </Link>
              <div className="muted">
                {names.get(task.object_id) ?? ''}
                {names.has(task.object_id) ? ' · ' : ''}
                {formatDate(task.created_at)}
              </div>
            </div>
            <Space wrap>
              <Tag color={statusColors[task.status]}>
                {statusLabels[task.status]}
              </Tag>
              {onEdit ? (
                <Button
                  onClick={() => onEdit(task)}
                  aria-label={`Изменить задачу: ${task.title}`}
                >
                  Изменить
                </Button>
              ) : null}
            </Space>
          </div>
        </List.Item>
      )}
    />
  );
}
