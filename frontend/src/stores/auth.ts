import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { UserRole } from "../types";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signUp: (email: string, password: string, role: UserRole, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchRoleFromProfile(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Failed to fetch role from profiles:", error);
    return null;
  }
  return data?.role ?? null;
}

async function resolveRole(user: User | null): Promise<UserRole | null> {
  if (!user) return null;

  const metadataRole = user.user_metadata?.role as UserRole | undefined;
  if (metadataRole === "teacher" || metadataRole === "student") {
    return metadataRole;
  }

  return fetchRoleFromProfile(user.id);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          console.error("Failed to load session:", error);
          setLoading(false);
          return;
        }
        setSession(session);
        const resolved = await resolveRole(session?.user ?? null);
        setRole(resolved);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Critical session load error:", err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const resolved = await resolveRole(session?.user ?? null);
      setRole(resolved);
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;

  const signUp = async (
    email: string,
    password: string,
    role: UserRole,
    displayName: string
  ): Promise<void> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, display_name: displayName } },
    });
    if (error) throw error;

    if (data.user && !data.session) {
      throw new Error("Please check your email to verify your account before signing in.");
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
