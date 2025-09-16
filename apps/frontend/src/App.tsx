import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MobileNavigation } from "@/components/ui/MobileNavigation";
import { usePerformanceMonitoring } from "@/hooks/usePerformanceMonitoring";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { cacheService } from "@/services/cacheService";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { UploadDemo } from "./pages/UploadDemo";
import { useEffect } from "react";

// Enhanced QueryClient with caching optimizations
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Performance monitoring wrapper component
function AppWithMonitoring() {
  const { trackFeature, trackError } = usePerformanceMonitoring({
    trackPageViews: true,
    trackUserInteractions: true,
    trackApiCalls: true,
    trackErrors: true,
  });

  const serviceWorker = useServiceWorker();

  useEffect(() => {
    // Track app initialization
    trackFeature('app_initialized', {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });

    // Set up global error boundary
    const handleError = (event: ErrorEvent) => {
      trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      trackError(new Error('Unhandled Promise Rejection'), {
        reason: event.reason
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [trackFeature, trackError]);

  // Track service worker status
  useEffect(() => {
    if (serviceWorker.isRegistered) {
      trackFeature('service_worker_registered');
    }
    if (serviceWorker.error) {
      trackError(serviceWorker.error, { context: 'service_worker' });
    }
  }, [serviceWorker.isRegistered, serviceWorker.error, trackFeature, trackError]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <div className="relative min-h-screen">
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="/upload-demo" element={
                  <ProtectedRoute>
                    <UploadDemo />
                  </ProtectedRoute>
                } />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <MobileNavigation />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const App = () => <AppWithMonitoring />;

export default App;
