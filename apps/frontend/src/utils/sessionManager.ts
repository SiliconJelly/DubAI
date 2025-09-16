import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

class SessionManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  constructor() {
    this.setupAutoRefresh();
  }

  private setupAutoRefresh() {
    // Listen for auth state changes to manage refresh timer
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        this.scheduleRefresh(session);
      } else if (event === 'SIGNED_OUT') {
        this.clearRefreshTimer();
      }
    });
  }

  private scheduleRefresh(session: Session | null) {
    this.clearRefreshTimer();

    if (!session?.expires_at) return;

    // Calculate time until token expires (refresh 5 minutes before expiry)
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const refreshAt = expiresAt - (5 * 60 * 1000); // 5 minutes before expiry
    const now = Date.now();
    const timeUntilRefresh = refreshAt - now;

    // Only schedule if the refresh time is in the future
    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshSession();
      }, timeUntilRefresh);

      console.log(`Session refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
    } else {
      // Token is already expired or about to expire, refresh immediately
      this.refreshSession();
    }
  }

  private clearRefreshTimer() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshSession() {
    if (this.isRefreshing) return;

    this.isRefreshing = true;

    try {
      console.log('Refreshing session...');
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Session refresh failed:', error);
        // If refresh fails, sign out the user
        await supabase.auth.signOut();
        return;
      }

      if (data.session) {
        console.log('Session refreshed successfully');
        this.scheduleRefresh(data.session);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await supabase.auth.signOut();
    } finally {
      this.isRefreshing = false;
    }
  }

  public async getValidSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
        return null;
      }

      if (!session) {
        return null;
      }

      // Check if token is expired or about to expire (within 1 minute)
      const expiresAt = session.expires_at! * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry < 60000) { // Less than 1 minute
        console.log('Token is about to expire, refreshing...');
        await this.refreshSession();
        
        // Get the refreshed session
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        return refreshedSession;
      }

      return session;
    } catch (error) {
      console.error('Error validating session:', error);
      return null;
    }
  }

  public destroy() {
    this.clearRefreshTimer();
  }
}

// Create singleton instance
export const sessionManager = new SessionManager();

// Utility function to get a valid access token
export async function getAccessToken(): Promise<string | null> {
  const session = await sessionManager.getValidSession();
  return session?.access_token || null;
}

// Utility function to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const session = await sessionManager.getValidSession();
  return !!session?.user;
}