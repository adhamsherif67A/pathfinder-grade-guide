import React, { createContext, useContext } from "react";

export type AppRole = "student" | "advisor";

export type AppProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role: AppRole;
  student_id?: string | null;
};

export type AppStudent = {
  id: string;
  registration_number: string;
  full_name: string;
  enrollment_year?: number | null;
  credits_earned?: number;
};

export type AppContextValue = {
  loading: boolean;
  profile: AppProfile | null;
  student: AppStudent | null;
  role: AppRole | null;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppContextProvider({
  value,
  children,
}: {
  value: AppContextValue;
  children: React.ReactNode;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppContextProvider");
  return ctx;
}
