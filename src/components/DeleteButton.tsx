import { useRef, useState } from 'react';
import { Alert, App, Button, Modal } from 'antd';

import { errorText } from '../lib/errors';

interface IDeleteButtonProps {
  kind: 'object' | 'task';
  name: string;
  remove: () => Promise<void>;
  onRemoved: () => void;
}

export function DeleteButton({
  kind,
  name,
  remove,
  onRemoved,
}: IDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const pending = useRef(false);
  const { message } = App.useApp();

  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await remove();
      setOpen(false);
      void message.success('Удалено безвозвратно');
      onRemoved();
    } catch (failure) {
      setError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        danger
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        Удалить
      </Button>
      <Modal
        title={
          kind === 'object'
            ? 'Удалить объект навсегда?'
            : 'Удалить задачу навсегда?'
        }
        open={open}
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
        onOk={() => void confirm()}
        okText="Удалить навсегда"
        cancelText="Отмена"
        okButtonProps={{ danger: true, disabled: busy }}
        confirmLoading={busy}
        cancelButtonProps={{ disabled: busy }}
        closable={!busy}
        maskClosable={!busy}
        keyboard={!busy}
      >
        <p>
          <strong>{name}</strong>
        </p>
        <p>
          {kind === 'object'
            ? 'Объект, все его задачи в любых статусах и вся история этих задач будут удалены безвозвратно, включая задачи, добавленные к моменту удаления.'
            : 'Задача и вся история её статусов будут удалены безвозвратно.'}
        </p>
        <p>Восстановить данные в приложении невозможно.</p>
        {error ? (
          <Alert type="error" showIcon message={errorText(error)} />
        ) : null}
      </Modal>
    </>
  );
}
