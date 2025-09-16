import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  fallback,
  redirectTo = '/auth' 
}: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (initialized && !loading && !user) {
      // Store the attempted location for redirect after login
      const from = location.pathname + location.search;
      navigate(redirectTo, { 
        state: { from },
        replace: true 
      });
    }
  }, [user, loading, initialized, navigate, redirectTo, location]);

  // Show loading spinner while auth is initializing
  if (!initialized || loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, return null (navigation will happen in useEffect)
  if (!user) {
    return null;
  }

  // User is authenticated, render children
  return <>{children}</>;
}

// Higher-order component version
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}