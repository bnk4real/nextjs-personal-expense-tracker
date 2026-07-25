'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import CalculatorDialog from '@/components/ui/calculator-dialog';
import { User, Settings, LogOut, Menu, Landmark } from 'lucide-react';

interface NavProps {
    onSidebarToggle: () => void;
}

interface UserData {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
}

// Function to get user data from cookies (only call on client side)
const getUserFromCookies = (): UserData | null => {
    if (typeof window === 'undefined') return null;

    const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
    };

    const token = getCookie('token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return {
                username: payload.username,
                email: payload.email,
                firstName: payload.firstName,
                lastName: payload.lastName,
                avatar: payload.avatar,
            };
        } catch (error) {
            console.error('Error parsing token:', error);
            return null;
        }
    }
    return null;
};

export default function Nav({ onSidebarToggle }: NavProps) {
    const [user, setUser] = useState<UserData | null>(getUserFromCookies);
    const router = useRouter();

    const handleLogout = useCallback(() => {
        if (typeof window !== 'undefined') {
            document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        setUser(null);
        router.push('/login');
    }, [router]);

    return (
        <nav className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur supports-backdrop-filter:bg-white/70">
            <div className="mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-14 justify-between">
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onSidebarToggle}
                            className="mr-2 lg:hidden"
                            aria-label="Open navigation"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>

                        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-950 lg:hidden">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-950 text-white">
                                <Landmark className="h-4 w-4" />
                            </span>
                            SubTracker
                        </Link>
                        <div className="hidden lg:block">
                            <p className="text-sm font-medium text-zinc-950">Personal finance workspace</p>
                            <p className="text-xs text-zinc-500">Ledger, imports, accounts, and review tools</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <CalculatorDialog />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={user?.avatar || undefined} alt="Profile" />
                                        <AvatarFallback>
                                            {user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || user.username[0].toUpperCase() : 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">
                                            {user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'User'}
                                        </p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {user?.email || 'user@example.com'}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/settings">
                                        <User className="mr-2 h-4 w-4" />
                                        Profile
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/settings">
                                        <Settings className="mr-2 h-4 w-4" />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </nav>
    );
}
