'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Bot,
    Camera,
    CheckCircle2,
    KeyRound,
    Loader2,
    Lock,
    Mail,
    PlugZap,
    Save,
    Trash2,
    User as UserIcon,
} from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/WorkspaceUI';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
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

interface GeminiSettings {
    configured: boolean;
    savedInApp: boolean;
    source: 'database' | 'environment' | 'none';
    keyHint: string | null;
    model: string;
    isEnabled: boolean;
    lastValidatedAt: string | null;
    encryptionReady: boolean;
}

const GEMINI_MODELS = [
    {
        value: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        searchText: 'gemini 2.5 flash fast',
    },
];

export default function SettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [geminiSettings, setGeminiSettings] = useState<GeminiSettings | null>(null);
    const [loadingGemini, setLoadingGemini] = useState(true);
    const [savingGemini, setSavingGemini] = useState(false);
    const [testingGemini, setTestingGemini] = useState(false);
    const [removingGemini, setRemovingGemini] = useState(false);
    const [removeGeminiOpen, setRemoveGeminiOpen] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
    const [geminiEnabled, setGeminiEnabled] = useState(true);
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

    const fetchGeminiSettings = async () => {
        setLoadingGemini(true);
        try {
            const response = await fetch('/api/ai-settings/gemini', {
                cache: 'no-store',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Failed to load Gemini settings');

            setGeminiSettings(data);
            setGeminiModel(data.model || 'gemini-2.5-flash');
            setGeminiEnabled(data.isEnabled !== false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to load Gemini settings');
        } finally {
            setLoadingGemini(false);
        }
    };

    useEffect(() => {
        fetchUserProfile();
        fetchGeminiSettings();
    }, []);

    const testGeminiConnection = async () => {
        setTestingGemini(true);
        try {
            const response = await fetch('/api/ai-settings/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: geminiApiKey,
                    model: geminiModel,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Gemini connection failed');

            toast.success(`Gemini connected with ${data.model}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gemini connection failed');
        } finally {
            setTestingGemini(false);
        }
    };

    const saveGeminiSettings = async (event: React.FormEvent) => {
        event.preventDefault();
        setSavingGemini(true);
        try {
            const response = await fetch('/api/ai-settings/gemini', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: geminiApiKey,
                    model: geminiModel,
                    isEnabled: geminiEnabled,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Failed to save Gemini settings');

            setGeminiSettings(data);
            setGeminiApiKey('');
            toast.success('Gemini settings saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save Gemini settings');
        } finally {
            setSavingGemini(false);
        }
    };

    const removeGeminiSettings = async () => {
        setRemovingGemini(true);
        try {
            const response = await fetch('/api/ai-settings/gemini', {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Failed to remove Gemini settings');

            setGeminiApiKey('');
            setRemoveGeminiOpen(false);
            await fetchGeminiSettings();
            toast.success(data.fallbackAvailable
                ? 'Saved Gemini key removed. Environment fallback is active.'
                : 'Gemini settings removed');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to remove Gemini settings');
        } finally {
            setRemovingGemini(false);
        }
    };

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
                description="Manage profile details, account security, and AI connections."
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
                <TabsList className="grid w-full max-w-xl grid-cols-3">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="ai">AI</TabsTrigger>
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

                <TabsContent value="ai">
                    <Card className="rounded-md">
                        <CardHeader className="border-b">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Bot className="h-5 w-5" />
                                        Gemini AI
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Used by AI Assistant and AI transaction drafts.
                                    </CardDescription>
                                </div>
                                {!loadingGemini && (
                                    <Badge
                                        variant="outline"
                                        className={geminiSettings?.configured && geminiSettings.isEnabled
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : 'border-zinc-200 bg-zinc-50 text-zinc-600'}
                                    >
                                        {geminiSettings?.configured && geminiSettings.isEnabled ? (
                                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                        ) : (
                                            <KeyRound className="mr-1 h-3.5 w-3.5" />
                                        )}
                                        {geminiSettings?.configured
                                            ? geminiSettings.isEnabled ? 'Connected' : 'Disabled'
                                            : 'Not configured'}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-5">
                            {loadingGemini ? (
                                <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading Gemini settings...
                                </div>
                            ) : (
                                <form onSubmit={saveGeminiSettings} className="space-y-5">
                                    {geminiSettings?.configured && (
                                        <div className="grid overflow-hidden rounded-md border bg-zinc-50 sm:grid-cols-3">
                                            <div className="border-b p-3 sm:border-b-0 sm:border-r">
                                                <p className="text-xs text-muted-foreground">Key</p>
                                                <p className="mt-1 text-sm font-medium">{geminiSettings.keyHint}</p>
                                            </div>
                                            <div className="border-b p-3 sm:border-b-0 sm:border-r">
                                                <p className="text-xs text-muted-foreground">Source</p>
                                                <p className="mt-1 text-sm font-medium">
                                                    {geminiSettings.source === 'database' ? 'Saved in app' : 'Environment fallback'}
                                                </p>
                                            </div>
                                            <div className="p-3">
                                                <p className="text-xs text-muted-foreground">Last validated</p>
                                                <p className="mt-1 text-sm font-medium">
                                                    {geminiSettings.lastValidatedAt
                                                        ? new Date(geminiSettings.lastValidatedAt).toLocaleString()
                                                        : 'Not tested in app'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {!geminiSettings?.encryptionReady && (
                                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                            Server encryption is not configured. Set a secure JWT secret or AI settings encryption key before saving.
                                        </div>
                                    )}

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="gemini-api-key">
                                                {geminiSettings?.savedInApp ? 'Replace API Key' : 'Gemini API Key'}
                                            </Label>
                                            <Input
                                                id="gemini-api-key"
                                                type="password"
                                                value={geminiApiKey}
                                                onChange={(event) => setGeminiApiKey(event.target.value)}
                                                placeholder={geminiSettings?.configured
                                                    ? `Leave blank to keep ${geminiSettings.keyHint}`
                                                    : 'Enter Gemini API key'}
                                                autoComplete="new-password"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                The key is encrypted on the server and is never returned to this page.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Model</Label>
                                            <SearchableSelect
                                                value={geminiModel}
                                                onValueChange={setGeminiModel}
                                                options={GEMINI_MODELS}
                                                placeholder="Select Gemini model"
                                                searchPlaceholder="Search models..."
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Gemini 2.5 Flash is the model currently available for this account.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                        <div>
                                            <Label htmlFor="gemini-enabled">Enable Gemini</Label>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Turn off AI Assistant and AI transaction drafting without removing the saved key.
                                            </p>
                                        </div>
                                        <Switch
                                            id="gemini-enabled"
                                            checked={geminiEnabled}
                                            onCheckedChange={setGeminiEnabled}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={testGeminiConnection}
                                            disabled={testingGemini || savingGemini}
                                        >
                                            {testingGemini
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <PlugZap className="h-4 w-4" />}
                                            Test Connection
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={savingGemini || testingGemini || !geminiSettings?.encryptionReady}
                                        >
                                            {savingGemini
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <Save className="h-4 w-4" />}
                                            {geminiSettings?.savedInApp ? 'Save Settings' : 'Save Gemini Key'}
                                        </Button>
                                        {geminiSettings?.savedInApp && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="sm:ml-auto"
                                                onClick={() => setRemoveGeminiOpen(true)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Remove Saved Key
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={removeGeminiOpen} onOpenChange={setRemoveGeminiOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remove Saved Gemini Key?</DialogTitle>
                        <DialogDescription>
                            The encrypted key and model settings will be removed. AI will use the environment fallback if it is still configured.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemoveGeminiOpen(false)} disabled={removingGemini}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={removeGeminiSettings} disabled={removingGemini}>
                            <Trash2 />
                            {removingGemini ? 'Removing...' : 'Remove Key'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
