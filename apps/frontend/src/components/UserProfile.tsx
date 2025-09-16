import { useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, User, Settings, LogOut, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export function UserProfile() {
  const { user, signOut } = useAuthContext();
  const { profile, stats, updateProfile, isUpdating, isLoading } = useUserProfile();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    fullName: '',
    avatarUrl: ''
  });

  const handleEditProfile = () => {
    if (profile) {
      setEditForm({
        username: profile.username,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl || ''
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(editForm);
      setIsEditDialogOpen(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const formatProcessingTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatarUrl} alt={profile?.fullName} />
              <AvatarFallback>
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{profile?.fullName || 'User'}</CardTitle>
              <CardDescription>@{profile?.username || user?.email?.split('@')[0]}</CardDescription>
              <Badge variant="secondary" className="mt-1">
                {profile?.subscriptionTier || 'free'}
              </Badge>
            </div>
          </div>
          <div className="flex space-x-2">
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleEditProfile}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                  <DialogDescription>
                    Update your profile information
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={editForm.username}
                      onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="avatarUrl">Avatar URL</Label>
                    <Input
                      id="avatarUrl"
                      value={editForm.avatarUrl}
                      onChange={(e) => setEditForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
                      placeholder="Enter avatar URL"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={isUpdating}>
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {stats && (
        <>
          <Separator />
          <CardContent className="pt-6">
            <div className="flex items-center mb-4">
              <BarChart3 className="h-5 w-5 mr-2" />
              <h3 className="text-lg font-semibold">Statistics</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalJobs}</div>
                <div className="text-sm text-muted-foreground">Total Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completedJobs}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.processingJobs}</div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatProcessingTime(stats.totalProcessingTime)}
                </div>
                <div className="text-sm text-muted-foreground">Total Time</div>
              </div>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}