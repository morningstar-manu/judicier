import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setToken } from "../api/client";

const AuthContext = createContext(null);
const STORAGE_KEY = "gestipers:token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setToken(saved);
          const { user: u } = await api.me();
          setUser(u);
        }
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (identifiant, motDePasse) => {
    const { token, user: u } = await api.login(identifiant, motDePasse);
    setToken(token);
    await AsyncStorage.setItem(STORAGE_KEY, token);
    setUser(u);
    return u;
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}
