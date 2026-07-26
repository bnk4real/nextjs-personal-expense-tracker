'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    ArrowRight,
    Eye,
    EyeOff,
    Landmark,
    LoaderCircle,
    LockKeyhole,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const updateField = (field: 'username' | 'password', value: string) => {
        setFormData((current) => ({ ...current, [field]: value }));
        if (error) setError('');
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const data = await response.json();
                document.cookie = `token=${data.token}; path=/; max-age=86400; samesite=strict`;
                router.push('/');
                return;
            }

            const errorData = await response.json();
            setError(errorData.error || 'Login failed');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative min-h-[100svh] overflow-hidden bg-zinc-950">
            <Image
                src="/subtracker-login-ledger.jpg"
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover object-[64%_center]"
            />
            <div className="absolute inset-0 bg-zinc-950/45" />

            <div className="relative grid min-h-[100svh] lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
                <section className="flex min-h-56 flex-col justify-between p-5 text-white sm:min-h-72 sm:p-8 lg:min-h-screen lg:p-12">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-black/45">
                            <Landmark className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="font-semibold leading-none">SubTracker</p>
                            <p className="mt-1 text-xs text-white/65">Personal ledger</p>
                        </div>
                    </div>

                    <div className="max-w-xl pb-2 lg:pb-10">
                        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-white/70">
                            <span className="h-1.5 w-1.5 bg-emerald-400" />
                            Private workspace
                        </p>
                        <h1 className="max-w-lg text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                            Your financial record, kept in order.
                        </h1>
                        <p className="mt-4 max-w-md text-sm leading-6 text-white/70 sm:text-base">
                            Return to the ledger and pick up exactly where you left off.
                        </p>
                    </div>
                </section>

                <section className="flex items-center bg-white px-5 py-9 sm:px-10 lg:m-5 lg:rounded-md lg:px-12">
                    <div className="mx-auto w-full max-w-sm">
                        <div className="mb-9">
                            <div className="mb-6 hidden h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white lg:flex">
                                <LockKeyhole className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-medium text-zinc-500">Welcome back</p>
                            <h2 className="mt-1 text-3xl font-bold text-zinc-950">Sign in</h2>
                            <p className="mt-2 text-sm text-zinc-500">
                                Continue to your personal ledger.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div
                                    role="alert"
                                    className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                                >
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    name="username"
                                    type="text"
                                    value={formData.username}
                                    onChange={(event) => updateField('username', event.target.value)}
                                    placeholder="Enter your username"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    className="h-11 bg-white"
                                    disabled={loading}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(event) => updateField('password', event.target.value)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        className="h-11 bg-white pr-11"
                                        disabled={loading}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((current) => !current)}
                                        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword
                                            ? <EyeOff className="h-4 w-4" />
                                            : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" size="lg" className="mt-2 h-11 w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        Sign in
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-10 flex items-center gap-2 border-t border-zinc-200 pt-5 text-xs text-zinc-500">
                            <LockKeyhole className="h-3.5 w-3.5" />
                            Private access
                            <span className="h-1 w-1 rounded-full bg-zinc-300" />
                            Session protected
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
