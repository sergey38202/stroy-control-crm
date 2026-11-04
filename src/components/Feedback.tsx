import { routes } from '../constants/routes';
import { Alert, Button, Result, Spin } from 'antd';
import { Link } from 'react-router-dom';

import { errorText } from '../lib/errors';

export function Loading() {
  return (
    <div className="loading" aria-live="polite">
      <Spin tip="Загрузка…">
        <div className="spinner-space" />
      </Spin>
    </div>
  );
}
export function ErrorPanel({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <Alert
      type="error"
      showIcon
      message={errorText(error)}
      action={<Button onClick={retry}>Повторить</Button>}
    />
  );
}
export function Unavailable() {
  return (
    <Result
      status="404"
      title="Запись недоступна"
      subTitle="Она удалена, не существует или у вас нет доступа."
      extra={<Link to={routes.objects}>К объектам</Link>}
    />
  );
}
