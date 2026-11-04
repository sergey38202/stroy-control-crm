import { useCallback, useRef, useState } from 'react';
import { Alert, App, Form, Input, Modal, Select } from 'antd';

import type { Task } from '../types/database';
import { db } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { getObjects, getWorkers } from '../lib/api';
import { useResource } from '../lib/useResource';

import { ErrorPanel, Loading } from './Feedback';

interface ITaskEditorProps {
  task?: Task;
  objectId?: string;
  onClose: () => void;
  onSaved: () => void;
}

type Values = {
  title: string;
  description: string;
  object_id: string;
  assignee_id: string;
};

export function TaskEditor({
  task,
  objectId,
  onClose,
  onSaved,
}: ITaskEditorProps) {
  const [form] = Form.useForm<Values>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const pending = useRef(false);
  const { message } = App.useApp();

  const options = useResource(
    useCallback(async () => {
      const [objects, workers] = await Promise.all([
        getObjects(),
        getWorkers(),
      ]);
      return { objects, workers };
    }, [])
  );

  async function save(values: Values) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);

    try {
      const args = {
        p_title: values.title.trim(),
        p_description: values.description ?? '',
        p_object_id: values.object_id,
        p_assignee_id: values.assignee_id,
      };
      const result = task
        ? await db().rpc('update_task', {
            ...args,
            p_task_id: task.id,
            p_expected_updated_at: task.updated_at,
          })
        : await db().rpc('create_task', args);
      if (result.error) throw result.error;
      void message.success(task ? 'Задача обновлена' : 'Задача создана');
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={task ? 'Редактировать задачу' : 'Новая задача'}
      onCancel={() => {
        if (!busy) onClose();
      }}
      onOk={() => form.submit()}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={busy}
      okButtonProps={{
        disabled:
          busy ||
          options.loading ||
          !options.data?.workers.length ||
          !options.data?.objects.length,
      }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      maskClosable={false}
      keyboard={!busy}
    >
      {error ? (
        <Alert type="error" message={errorText(error)} className="form-alert" />
      ) : null}
      {options.loading ? (
        <Loading />
      ) : options.error ? (
        <ErrorPanel
          error={options.error}
          retry={() => void options.refresh()}
        />
      ) : (
        <>
          {!options.data?.workers.length ? (
            <Alert
              type="warning"
              message="Администратор должен создать хотя бы одного исполнителя."
            />
          ) : null}
          <Form
            form={form}
            layout="vertical"
            initialValues={
              task ?? { title: '', description: '', object_id: objectId }
            }
            onFinish={values => void save(values)}
            disabled={busy}
          >
            <Form.Item
              name="title"
              label="Название"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Введите название',
                },
                { max: 200 },
              ]}
            >
              <Input maxLength={200} autoFocus />
            </Form.Item>
            <Form.Item
              name="description"
              label="Описание"
              rules={[{ max: 10000 }]}
            >
              <Input.TextArea rows={4} maxLength={10000} />
            </Form.Item>
            <Form.Item
              name="object_id"
              label="Объект"
              rules={[{ required: true, message: 'Выберите объект' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={options.data?.objects.map(object => ({
                  value: object.id,
                  label: object.name,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="assignee_id"
              label="Исполнитель"
              rules={[{ required: true, message: 'Выберите исполнителя' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={options.data?.workers.map(worker => ({
                  value: worker.id,
                  label: worker.display_name,
                }))}
              />
            </Form.Item>
            {task ? (
              <p className="muted">
                Статус, автор и время создания сохраняются. При смене
                исполнителя доступ к задаче и её истории перейдёт новому
                исполнителю.
              </p>
            ) : null}
          </Form>
        </>
      )}
    </Modal>
  );
}
