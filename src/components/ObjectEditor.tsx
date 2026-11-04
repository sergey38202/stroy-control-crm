import { useRef, useState } from 'react';
import { Alert, App, Form, Input, Modal } from 'antd';

import type { ConstructionObject } from '../types/database';
import { db } from '../lib/supabase';
import { errorText } from '../lib/errors';

interface IObjectEditorProps {
  object?: ConstructionObject;
  onClose: () => void;
  onSaved: () => void;
}

interface IObjectEditorForm {
  name: string;
  address: string;
}

export function ObjectEditor({ object, onClose, onSaved }: IObjectEditorProps) {
  const [form] = Form.useForm<IObjectEditorForm>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const pending = useRef(false);
  const { message } = App.useApp();

  async function save(values: IObjectEditorForm) {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError(undefined);

    try {
      const args = {
        p_name: values.name.trim(),
        p_address: values.address ?? '',
      };

      const result = object
        ? await db().rpc('update_object', {
            ...args,
            p_object_id: object.id,
            p_expected_updated_at: object.updated_at,
          })
        : await db().rpc('create_object', args);

      if (result.error) throw result.error;
      void message.success(object ? 'Объект обновлён' : 'Объект создан');
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
      title={object ? 'Редактировать объект' : 'Новый объект'}
      onCancel={() => {
        if (!busy) onClose();
      }}
      onOk={() => form.submit()}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={busy}
      okButtonProps={{ disabled: busy }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      maskClosable={false}
      keyboard={!busy}
    >
      {error ? (
        <Alert type="error" message={errorText(error)} className="form-alert" />
      ) : null}
      <Form
        form={form}
        layout="vertical"
        initialValues={object ?? { name: '', address: '' }}
        onFinish={values => void save(values)}
        disabled={busy}
      >
        <Form.Item
          name="name"
          label="Название"
          rules={[
            { required: true, whitespace: true, message: 'Введите название' },
            { max: 200 },
          ]}
        >
          <Input maxLength={200} autoFocus />
        </Form.Item>
        <Form.Item name="address" label="Адрес" rules={[{ max: 500 }]}>
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
