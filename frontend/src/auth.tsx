import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getMe, isLoggedIn, setToken, type AuthUser } from "./api";

type AuthContextValue = {
  loggedIn: boolean;
  user: AuthUser | null;
  completeLogin: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      return;
    }
    getMe()
      .then((nextUser) => {
        setUser(nextUser);
        setLoggedIn(true);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        setLoggedIn(false);
      });
  }, []);

  const value = useMemo(
    () => ({
      loggedIn,
      user,
      completeLogin(token: string, nextUser: AuthUser) {
        setToken(token);
        setUser(nextUser);
        setLoggedIn(true);
      },
      logout() {
        setToken(null);
        setUser(null);
        setLoggedIn(false);
      },
    }),
    [loggedIn, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
