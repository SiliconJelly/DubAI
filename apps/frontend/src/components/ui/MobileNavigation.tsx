import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Upload, 
  Activity, 
  User, 
  Menu, 
  X, 
  LogOut,
  Settings,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'upload', label: 'Upload', icon: Upload, path: '/upload' },
  { id: 'dashboard', label: 'Dashboard', icon: Activity, path: '/dashboard' },
  { id: 'history', label: 'History', icon: History, path: '/history' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];

interface MobileNavigationProps {
  className?: string;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, isTablet } = useResponsive();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  // Show mobile navigation only on mobile and tablet
  if (!isMobile && !isTablet) {
    return null;
  }

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <div className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border/50',
          'safe-area-inset-bottom',
          className
        )}>
          <div className="flex items-center justify-around px-2 py-2">
            {navigationItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    'flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-0 flex-1',
                    'touch-manipulation select-none',
                    isActive 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {item.badge && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs mt-1 truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
            
            {/* Menu Button */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-0 flex-1 text-muted-foreground hover:text-foreground hover:bg-accent/50 touch-manipulation select-none">
                  <Menu className="h-5 w-5" />
                  <span className="text-xs mt-1">More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto max-h-[80vh]">
                <MobileMenu onNavigate={handleNavigation} onSignOut={handleSignOut} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      {/* Tablet Side Navigation */}
      {isTablet && (
        <div className={cn(
          'fixed left-0 top-0 bottom-0 z-40 w-16 bg-background/95 backdrop-blur-lg border-r border-border/50',
          'flex flex-col items-center py-4 space-y-4',
          className
        )}>
          {/* Logo */}
          <div className="relative mb-4">
            <img 
              src={logo} 
              alt="DubAI" 
              className="h-8 w-8 object-contain"
            />
          </div>

          {/* Navigation Items */}
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
                  'touch-manipulation select-none',
                  isActive 
                    ? 'text-primary bg-primary/10' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
                {item.badge && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}

          {/* Settings and Sign Out */}
          <div className="mt-auto space-y-2">
            <button
              onClick={() => handleNavigation('/settings')}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 touch-manipulation select-none"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 touch-manipulation select-none"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface MobileMenuProps {
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ onNavigate, onSignOut }) => {
  return (
    <div className="space-y-4 pb-safe">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Menu</h3>
      </div>
      
      <div className="space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start h-12 text-left"
          onClick={() => onNavigate('/profile')}
        >
          <User className="h-5 w-5 mr-3" />
          Profile
        </Button>
        
        <Button
          variant="ghost"
          className="w-full justify-start h-12 text-left"
          onClick={() => onNavigate('/settings')}
        >
          <Settings className="h-5 w-5 mr-3" />
          Settings
        </Button>
        
        <Button
          variant="ghost"
          className="w-full justify-start h-12 text-left"
          onClick={() => onNavigate('/history')}
        >
          <History className="h-5 w-5 mr-3" />
          Job History
        </Button>
      </div>
      
      <div className="border-t pt-4">
        <Button
          variant="outline"
          className="w-full justify-start h-12 text-left"
          onClick={onSignOut}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};