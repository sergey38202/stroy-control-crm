import { lazy, Suspense, useState, type ReactNode } from 'react';
import { App as AntApp, Button, Result, Space } from 'antd';
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { AuthProvider, useAuth } from './lib/auth';
import { db, supabase } from './lib/supabase';
import { errorText } from './lib/errors';
import { Loading, Unavailable } from './components/Feedback';
import { routes } from './constants/routes';
import { roleLabels, UserRole } from './types/domain';

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then(module => ({ default: module.LoginPage }))
);
const ObjectsPage = lazy(() =>
  import('./pages/ObjectsPage').then(module => ({ default: module.ObjectsPage }))
);
const ObjectPage = lazy(() =>
  import('./pages/ObjectPage').then(module => ({ default: module.ObjectPage }))
);
const TaskPage = lazy(() =>
  import('./pages/TaskPage').then(module => ({ default: module.TaskPage }))
);
const MyTasksPage = lazy(() =>
  import('./pages/MyTasksPage').then(module => ({ default: module.MyTasksPage }))
);

function Protected({ children }: { children: ReactNode }) {
  return useAuth().session ? children : <Navigate to={routes.login} replace />;
}

function Home() {
  return (
    <Navigate
      to={
        useAuth().profile?.role === UserRole.Worker
          ? routes.myTasks
          : routes.objects
      }
      replace
    />
  );
}

function Shell() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const { message } = AntApp.useApp();
  const location = useLocation();
  async function logout() {
    setBusy(true);
    try {
      const { error } = await db().auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) {
      void message.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell" key={profile?.id}>
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <header className="app-header">
        <Link to={routes.home} className="brand">
          <span className="brand-mark" aria-hidden="true">
            СК
          </span>
          <span>
            <strong>СтройКонтроль</strong>
            <small>Объекты и задачи</small>
          </span>
        </Link>
        <nav aria-label="Основная навигация">
          <NavLink to={routes.objects}>Объекты</NavLink>
          <NavLink to={routes.myTasks}>
            {profile?.role === UserRole.Manager ? 'Все задачи' : 'Мои задачи'}
          </NavLink>
        </nav>
        <Space wrap>
          <div className="user-info">
            <strong>{profile?.display_name}</strong>
            <small>{profile ? roleLabels[profile.role] : ''}</small>
          </div>
          <Button onClick={() => void logout()} loading={busy}>
            Выйти
          </Button>
        </Space>
      </header>
      <main
        id="main-content"
        className="main-content"
        key={`${profile?.id}:${location.pathname}`}
      >
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="app-footer">
        СтройКонтроль · Рабочее пространство команды
      </footer>
    </div>
  );
}

export default function App() {
  if (!supabase)
    return (
      <main className="center">
        <Result
          status="info"
          title="Настройте подключение к Supabase"
          subTitle="Создайте .env по образцу .env.example, укажите URL проекта и публичный ключ, затем перезапустите Vite. Инструкция находится в README.md."
        />
      </main>
    );
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path={routes.login} element={<LoginPage />} />
            <Route
              element={
                <Protected>
                  <Shell />
                </Protected>
              }
            >
              <Route index element={<Home />} />
              <Route path={routes.objects} element={<ObjectsPage />} />
              <Route path={routes.object.pattern} element={<ObjectPage />} />
              <Route path={routes.task.pattern} element={<TaskPage />} />
              <Route path={routes.myTasks} element={<MyTasksPage />} />
              <Route path={routes.notFound} element={<Unavailable />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
