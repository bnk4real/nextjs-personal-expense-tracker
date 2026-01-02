'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Nav from '@/components/app/Nav';
import Sidebar from '@/components/app/Sidebar';
import { Toaster } from "sonner";

interface LayoutClientProps {
    children: React.ReactNode;
}

export default function LayoutClient({ children }: LayoutClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const pathname = usePathname();

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Check authentication status
    useEffect(() => {
        const checkAuth = () => {
            if (typeof window !== 'undefined') {
                const getCookie = (name: string) => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) return parts.pop()?.split(';').shift();
                };

                const token = getCookie('token');
                setIsAuthenticated(!!token);
            }
        };

        checkAuth();
    }, [pathname]); // Re-check when pathname changes

    // Public routes that don't need sidebar/nav
    const publicRoutes = ['/login', '/register'];
    const isPublicRoute = publicRoutes.includes(pathname);

    // Show sidebar/nav only on authenticated routes that are not public
    const shouldShowSidebar = isAuthenticated && !isPublicRoute;

    if (isPublicRoute) {
        // Public routes (login/register) - no sidebar/nav
        return (
            <div className="min-h-screen bg-gray-100">
                {children}
            </div>
        );
    }

    return (
        <>
            {shouldShowSidebar && (
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            )}
            <div className="min-h-screen bg-gray-100">
                {shouldShowSidebar && (
                    <Nav onSidebarToggle={toggleSidebar} />
                )}
                <main className={shouldShowSidebar ? "lg:ml-64" : ""}>
                    {children}
                </main>
            </div>
            <Toaster />
        </>
    );
}