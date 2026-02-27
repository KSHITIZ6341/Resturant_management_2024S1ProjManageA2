import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UserRole = 'admin' | 'manager' | 'staff';

export interface UserAccount {
  id: string;
  name: string;
  role: UserRole;
  password?: string;
}

interface OperationResult {
  success: boolean;
  message?: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserAccount | null;
  users: UserAccount[];
  login: (userId: string, password?: string) => boolean;
  logout: () => void;
  addUser: (input: { name: string; role: UserRole; password?: string }) => OperationResult;
  updateUser: (id: string, updates: Partial<Omit<UserAccount, 'id'>>) => OperationResult;
  removeUser: (id: string) => OperationResult;
}

const ACTIVE_USER_STORAGE_KEY = 'restaurant-ms/auth-user-id';
const USERS_STORAGE_KEY = 'restaurant-ms/users';

const DEFAULT_USERS: UserAccount[] = [
  { id: 'admin', name: 'Administrator', role: 'admin', password: 'admin' },
  { id: 'manager', name: 'Main Manager', role: 'manager', password: 'manager' },
  { id: 'elodie', name: 'Elodie', role: 'staff' },
  { id: 'matt', name: 'Matt', role: 'staff' },
  { id: 'anna', name: 'Anna', role: 'staff' }
];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

function sanitiseName(name: string) {
  return name.trim();
}

function generateUserId(base: string) {
  const cleaned = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto.randomUUID() as string).split('-')[0]
    : Math.random().toString(36).slice(2, 8);
  return `${cleaned || 'user'}-${suffix}`;
}

function normaliseUsers(users: UserAccount[]): UserAccount[] {
  const deduped = new Map<string, UserAccount>();
  users.forEach((user) => {
    const nameKey = user.name.toLowerCase();
    if (!deduped.has(nameKey)) {
      deduped.set(nameKey, user);
    }
  });

  const ensured = new Map<string, UserAccount>();
  const merged = [...DEFAULT_USERS, ...deduped.values()];
  merged.forEach((user) => {
    ensured.set(user.id, { ...user, name: sanitiseName(user.name) });
  });

  return Array.from(ensured.values());
}

function loadStoredUsers(): UserAccount[] {
  if (typeof window === 'undefined') {
    return DEFAULT_USERS;
  }
  const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_USERS;
  }
  try {
    const parsed = JSON.parse(raw) as UserAccount[];
    if (!Array.isArray(parsed)) {
      return DEFAULT_USERS;
    }
    return normaliseUsers(parsed);
  } catch (error) {
    console.warn('Failed to parse stored users; falling back to defaults.', error);
    return DEFAULT_USERS;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => loadStoredUsers());
  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const persistActiveUserId = useCallback((userId: string | null) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (userId) {
      window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    } else {
      window.localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  const currentUser = useMemo(
    () => (activeUserId ? users.find((candidate) => candidate.id === activeUserId) ?? null : null),
    [activeUserId, users]
  );

  useEffect(() => {
    if (currentUser) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      if (activeUserId) {
        persistActiveUserId(null);
      }
    }
  }, [currentUser, activeUserId, persistActiveUserId]);

  const login = useCallback(
    (userId: string, password?: string) => {
      const account = users.find((candidate) => candidate.id === userId);
      if (!account) {
        return false;
      }

      if (account.password && account.password.length > 0) {
        if (!password || password !== account.password) {
          return false;
        }
      }

      setActiveUserId(account.id);
      setIsAuthenticated(true);
      persistActiveUserId(account.id);
      return true;
    },
    [persistActiveUserId, users]
  );

  const logout = useCallback(() => {
    setActiveUserId(null);
    setIsAuthenticated(false);
    persistActiveUserId(null);
  }, [persistActiveUserId]);

  const addUser = useCallback(
    (input: { name: string; role: UserRole; password?: string }): OperationResult => {
      const name = sanitiseName(input.name);
      if (!name) {
        return { success: false, message: 'Name is required.' };
      }

      if (users.some((candidate) => candidate.name.toLowerCase() === name.toLowerCase())) {
        return { success: false, message: 'A user with this name already exists.' };
      }

      const newUser: UserAccount = {
        id: generateUserId(name),
        name,
        role: input.role,
        password: input.password?.trim() || undefined
      };

      setUsers((previous) => [...previous, newUser]);
      return { success: true };
    },
    [users]
  );

  const updateUser = useCallback(
    (id: string, updates: Partial<Omit<UserAccount, 'id'>>): OperationResult => {
      const target = users.find((candidate) => candidate.id === id);
      if (!target) {
        return { success: false, message: 'User not found.' };
      }

      const nextName = updates.name !== undefined ? sanitiseName(updates.name) : target.name;
      if (!nextName) {
        return { success: false, message: 'Name cannot be empty.' };
      }

      if (
        nextName.toLowerCase() !== target.name.toLowerCase() &&
        users.some((candidate) => candidate.id !== id && candidate.name.toLowerCase() === nextName.toLowerCase())
      ) {
        return { success: false, message: 'Another user already has that name.' };
      }

      const nextUser: UserAccount = {
        ...target,
        ...updates,
        name: nextName,
        password: updates.password !== undefined ? updates.password || undefined : target.password
      };

      setUsers((previous) => previous.map((candidate) => (candidate.id === id ? nextUser : candidate)));
      return { success: true };
    },
    [users]
  );

  const removeUser = useCallback(
    (id: string): OperationResult => {
      const target = users.find((candidate) => candidate.id === id);
      if (!target) {
        return { success: false, message: 'User not found.' };
      }

      if (target.role === 'admin') {
        return { success: false, message: 'The administrator account cannot be removed.' };
      }

      setUsers((previous) => previous.filter((candidate) => candidate.id !== id));

      if (activeUserId === id) {
        logout();
      }

      return { success: true };
    },
    [activeUserId, logout, users]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      user: currentUser,
      users,
      login,
      logout,
      addUser,
      updateUser,
      removeUser
    }),
    [addUser, currentUser, isAuthenticated, login, logout, removeUser, updateUser, users]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
