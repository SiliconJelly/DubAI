import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<void>;
  refreshSession: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false
  });

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          toast.error('Failed to initialize authentication');
        }

        if (mounted) {
          setState(prev => ({
            ...prev,
            user: session?.user || null,
            session: session || null,
            loading: false,
            initialized: true
          }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            initialized: true
          }));
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (mounted) {
          setState(prev => ({
            ...prev,
            user: session?.user || null,
            session: session || null,
            loading: false,
            initialized: true
          }));
        }

        // Handle specific auth events
        switch (event) {
          case 'SIGNED_IN':
            toast.success('Successfully signed in!');
            break;
          case 'SIGNED_OUT':
            toast.success('Successfully signed out!');
            break;
          case 'TOKEN_REFRESHED':
            console.log('Token refreshed successfully');
            break;
          case 'USER_UPDATED':
            console.log('User updated');
            break;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        throw error;
      }

      toast.success('Check your email for the confirmation link!');
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message || 'Failed to sign up');
      }
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(error.message || 'Failed to sign out');
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'apple') => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error(`${provider} sign in error:`, error);
      toast.error(`Failed to sign in with ${provider}`);
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Session refresh error:', error);
      // Don't show toast for refresh errors as they happen automatically
      throw error;
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting access token:', error);
        return null;
      }
      
      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    refreshSession,
    getAccessToken
  };
}