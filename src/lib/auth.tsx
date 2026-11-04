import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { Alert, Button, Result, Spin } from 'antd';

import type { Profile } from '../types/database';

import { db } from './supabase';
import { errorText } from './errors';

type AuthState = { session: Session | null; profile: Profile | null };

const AuthContext = createContext<AuthState>({ session: null, profile: null });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;
    let events = 0;

    const { data } = db().auth.onAuthStateChange((_event, next) => {
      events++;
      if (alive) {
        setSession(next);
        setRestoring(false);
      }
    });

    const before = events;

    void db()
      .auth.getSession()
      .then(({ data: initial, error: failure }) => {
        if (!alive || events !== before) return;
        if (failure) setError(failure);
        setSession(initial.session);
        setRestoring(false);
      })
      .catch((failure: unknown) => {
        if (alive) {
          setError(failure);
          setRestoring(false);
        }
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    let alive = true;
    setProfile(null);
    setProfileFor(null);
    setError(undefined);
    if (!userId) return;
    void db()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(
        ({ data, error: failure }) => {
          if (!alive) return;
          setProfile(data);
          setProfileFor(userId);
          if (failure) setError(failure);
        },
        (failure: unknown) => {
          if (alive) {
            setError(failure);
            setProfileFor(userId);
          }
        }
      );
    return () => {
      alive = false;
    };
  }, [userId, retry]);

  async function signOut() {
    setSigningOut(true);
    try {
      const { error: failure } = await db().auth.signOut({ scope: 'local' });
      if (failure) throw failure;
      setSession(null);
      setProfile(null);
    } catch (failure) {
      setError(failure);
    } finally {
      setSigningOut(false);
    }
  }

  if (restoring || (userId && profileFor !== userId))
    return (
      <div className="center">
        <Spin tip="Восстанавливаем сессию…">
          <div className="spinner-space" />
        </Spin>
      </div>
    );

  if (!userId && error)
    return (
      <Result
        status="warning"
        title="Не удалось восстановить сессию"
        subTitle={errorText(error)}
        extra={
          <Button onClick={() => setError(undefined)}>Перейти ко входу</Button>
        }
      />
    );

  if (userId && (!profile || error))
    return (
      <Result
        status="warning"
        title="Профиль недоступен"
        subTitle="Администратор должен создать профиль и назначить роль вашей учётной записи."
        extra={
          <>
            <Button onClick={() => setRetry(value => value + 1)}>
              Повторить
            </Button>{' '}
            <Button loading={signingOut} onClick={() => void signOut()}>
              Выйти
            </Button>
            {error ? <Alert type="error" message={errorText(error)} /> : null}
          </>
        }
      />
    );

  return (
    <AuthContext.Provider value={{ session, profile }}>
      {children}
    </AuthContext.Provider>
  );
}
