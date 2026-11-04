import { routes } from '../constants/routes';
import { useRef, useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../lib/auth';
import { db } from '../lib/supabase';
import { errorText } from '../lib/errors';

interface ILoginPageForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const pending = useRef(false);

  async function login(values: ILoginPageForm) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);

    try {
      const { error: failure } = await db().auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (failure) throw failure;
    } catch (failure) {
      setError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (session) return <Navigate to={routes.home} replace />;
  return (
    <main className="login-page">
      <div className="login-intro">
        <span className="brand-mark" aria-hidden="true">
          СК
        </span>
        <Typography.Title>СтройКонтроль</Typography.Title>
        <p>Объекты и задачи</p>
        <p className="login-description">
          От постановки задачи до приёмки работ — всё в одном месте.
        </p>
      </div>
      <Card className="login-card" title="Вход в систему">
        {error ? (
          <Alert
            type="error"
            showIcon
            message={errorText(error)}
            className="form-alert"
          />
        ) : null}
        <Form
          layout="vertical"
          onFinish={values => void login(values)}
          disabled={busy}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Проверьте адрес email' },
            ]}
          >
            <Input autoComplete="username" type="email" autoFocus />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} block>
            Войти
          </Button>
        </Form>
        <p className="muted">Учётную запись и доступ выдаёт администратор.</p>
      </Card>
    </main>
  );
}
