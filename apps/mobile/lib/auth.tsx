import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4001/api';

type Role = 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

type Session = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

const SESSION_KEY = 'cerebromat_mobile_session';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          setSession(JSON.parse(stored) as Session);
        } catch {
          await AsyncStorage.removeItem(SESSION_KEY);
        }
      }
      setLoading(false);
    }

    void bootstrap();
  }, []);

  async function persist(next: Session | null) {
    setSession(next);
    if (!next) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
  }

  async function login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as Session;
    await persist(data);
  }

  async function logout() {
    if (session) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
      } catch {
        // noop
      }
    }

    await persist(null);
  }

  async function refreshSession(current: Session): Promise<Session | null> {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });

    if (!response.ok) {
      await persist(null);
      return null;
    }

    const next = (await response.json()) as Session;
    await persist(next);
    return next;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const current = options.auth ? session : null;

    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(current ? { Authorization: `Bearer ${current.accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401 && current && options.auth) {
      const refreshed = await refreshSession(current);
      if (refreshed) {
        return request<T>(path, options);
      }
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return (await response.json()) as T;
  }

  const value: AuthContextValue = {
    session,
    loading,
    login,
    logout,
    request,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
