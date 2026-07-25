'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, Lock, Mail, Save, User as UserIcon } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/WorkspaceUI';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface User {
    user_id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    createdAt?: string;
}

export default function SettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [profileData, setProfileData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const initials = useMemo(() => {
        const nameInitials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.trim();
        return (nameInitials || user?.username?.[0] || 'U').toUpperCase();
    }, [user]);

    const displayName = useMemo(() => {
        const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
        return fullName || user?.username || 'User';
    }, [user]);

    const fetchUserProfile = async () => {
        try {
            const response = await fetch('/api/user/profile');
            if (!response.ok) return;

            const userData = await response.json();
            setUser(userData);
            setProfileData({
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                email: userData.email || '',
                username: userData.username || '',
            });
        } catch {
            toast.error('Failed to fetch user profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const handleProfileUpdate = async (event: React.FormEvent) => {
        event.preventDefault();
        setSavingProfile(true);

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData),
            });

            if (response.ok) {
                toast.success('Profile updated');
                fetchUserProfile();
            } else {
                const data = await response.json();
                toast.error(`Failed to update profile: ${data.error}`);
            }
        } catch {
            toast.error('Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordUpdate = async (event: React.FormEvent) => {
        event.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        setSavingPassword(true);

        try {
            const response = await fetch('/api/user/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword,
                }),
            });

            if (response.ok) {
                toast.success('Password updated');
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                });
            } else {
                const data = await response.json();
                toast.error(`Failed to update password: ${data.error}`);
            }
        } catch {
            toast.error('Failed to update password');
        } finally {
            setSavingPassword(false);
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);
        setUploadingAvatar(true);

        try {
            const response = await fetch('/api/user/avatar', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                toast.success('Avatar updated');
                fetchUserProfile();
            } else {
                toast.error('Failed to update avatar');
            }
        } catch {
            toast.error('Failed to update avatar');
        } finally {
            setUploadingAvatar(false);
            event.target.value = '';
        }
    };

    if (loading) {
        return (
            <div className="mx-auto flex min-h-80 max-w-5xl items-center justify-center p-6">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
                <PageHeader title="Settings" description="Manage profile and account security." />
                <EmptyState title="Profile unavailable" description="Refresh the page or sign in again." />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
            <PageHeader
                title="Settings"
                description="Manage profile details, avatar, and account security."
            />

            <Card className="rounded-md">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={user.avatar} alt={displayName} />
                            <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="truncate text-lg font-semibold">{displayName}</p>
                            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                    </div>
                    <Label htmlFor="avatar-upload" className="w-full cursor-pointer sm:w-auto">
                        <div className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground sm:w-auto">
                            {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            Change Avatar
                        </div>
                        <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            disabled={uploadingAvatar}
                        />
                    </Label>
                </CardContent>
            </Card>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                    <Card className="rounded-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserIcon className="h-5 w-5" />
                                Profile Information
                            </CardTitle>
                            <CardDescription>Update the identity shown across the app.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleProfileUpdate} className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First name</Label>
                                        <Input
                                            id="firstName"
                                            value={profileData.firstName}
                                            onChange={(event) => setProfileData({ ...profileData, firstName: event.target.value })}
                                            placeholder="First name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last name</Label>
                                        <Input
                                            id="lastName"
                                            value={profileData.lastName}
                                            onChange={(event) => setProfileData({ ...profileData, lastName: event.target.value })}
                                            placeholder="Last name"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                type="email"
                                                value={profileData.email}
                                                onChange={(event) => setProfileData({ ...profileData, email: event.target.value })}
                                                className="pl-10"
                                                placeholder="email@example.com"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="username">Username</Label>
                                        <Input
                                            id="username"
                                            value={profileData.username}
                                            onChange={(event) => setProfileData({ ...profileData, username: event.target.value })}
                                            placeholder="username"
                                            required
                                        />
                                    </div>
                                </div>

                                <Button type="submit" disabled={savingProfile}>
                                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Changes
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security">
                    <Card className="rounded-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Password
                            </CardTitle>
                            <CardDescription>Use a password with at least 6 characters.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordUpdate} className="max-w-xl space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currentPassword">Current password</Label>
                                    <Input
                                        id="currentPassword"
                                        type="password"
                                        value={passwordData.currentPassword}
                                        onChange={(event) => setPasswordData({ ...passwordData, currentPassword: event.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">New password</Label>
                                        <Input
                                            id="newPassword"
                                            type="password"
                                            value={passwordData.newPassword}
                                            onChange={(event) => setPasswordData({ ...passwordData, newPassword: event.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm password</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            value={passwordData.confirmPassword}
                                            onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <Button type="submit" disabled={savingPassword}>
                                    {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                                    Update Password
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
