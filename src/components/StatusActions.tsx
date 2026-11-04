import { TaskStatus, UserRole } from '../types/domain';
import { useRef, useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Space } from 'antd';

import type { Profile, Task } from '../types/database';
import { db } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { statusLabels } from '../lib/status';

interface IStatusActionsProps {
  task: Task;
  profile: Profile;
  onChanged: () => void;
}

interface IStatusActionsForm {
  comment?: string;
}

export function StatusActions({
  task,
  profile,
  onChanged,
}: IStatusActionsProps) {
  const [target, setTarget] = useState<TaskStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [form] = Form.useForm<IStatusActionsForm>();
  const pending = useRef(false);
  const { message } = App.useApp();

  const actions: { status: TaskStatus; label: string }[] = [];
  if (profile.role === UserRole.Worker && profile.id === task.assignee_id) {
    if (task.status === TaskStatus.New || task.status === TaskStatus.Revision)
      actions.push({ status: TaskStatus.InProgress, label: 'Начать работу' });
    if (task.status === TaskStatus.InProgress)
      actions.push({ status: TaskStatus.InReview, label: 'Отправить на проверку' });
  }

  if (profile.role === UserRole.Manager && task.status === TaskStatus.InReview) {
    actions.push(
      { status: TaskStatus.Accepted, label: 'Принять' },
      { status: TaskStatus.Revision, label: 'Вернуть на доработку' }
    );
  }

  async function save(values: IStatusActionsForm) {
    if (!target || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);

    try {
      const { error: failure } = await db().rpc('change_task_status', {
        p_task_id: task.id,
        p_to_status: target,
        p_expected_updated_at: task.updated_at,
        p_comment: values.comment?.trim() || null,
      });

      if (failure) throw failure;
      setTarget(null);
      void message.success('Статус изменён');
      onChanged();
    } catch (failure) {
      setError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Space wrap>
        {actions.map(action => (
          <Button
            key={action.status}
            type={action.status === TaskStatus.Revision ? 'default' : 'primary'}
            onClick={() => {
              form.resetFields();
              setError(undefined);
              setTarget(action.status);
            }}
          >
            {action.label}
          </Button>
        ))}
      </Space>
      <Modal
        open={target !== null}
        title={target ? `Перевести в статус «${statusLabels[target]}»` : ''}
        onCancel={() => {
          if (!busy) setTarget(null);
        }}
        onOk={() => form.submit()}
        okText="Подтвердить"
        cancelText="Отмена"
        confirmLoading={busy}
        okButtonProps={{ disabled: busy }}
        cancelButtonProps={{ disabled: busy }}
        closable={!busy}
        maskClosable={false}
        keyboard={!busy}
      >
        {error ? (
          <Alert
            type="error"
            message={errorText(error)}
            className="form-alert"
          />
        ) : null}
        <Form
          form={form}
          layout="vertical"
          onFinish={values => void save(values)}
          disabled={busy}
        >
          <Form.Item
            name="comment"
            label={
              target === TaskStatus.Revision
                ? 'Причина доработки'
                : 'Комментарий (необязательно)'
            }
            rules={[
              {
                required: target === TaskStatus.Revision,
                whitespace: target === TaskStatus.Revision,
                message: 'Укажите причину доработки',
              },
              { max: 2000 },
            ]}
          >
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
