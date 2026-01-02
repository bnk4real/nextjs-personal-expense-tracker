'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    Tag,
    Wallet,
    Repeat,
    DollarSign,
    Calculator,
    Settings,
    X
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const navigationItems = [
    {
        href: '/',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
        href: '/incomes',
        label: 'Incomes',
        icon: <TrendingUp className="w-5 h-5" />,
    },
    {
        href: '/expenses',
        label: 'Expenses',
        icon: <TrendingDown className="w-5 h-5" />,
    },
    {
        href: '/categories',
        label: 'Categories',
        icon: <Tag className="w-5 h-5" />,
    },
    {
        href: '/accounts',
        label: 'Accounts',
        icon: <Wallet className="w-5 h-5" />,
    },
    {
        href: '/subscriptions',
        label: 'Subscriptions',
        icon: <Repeat className="w-5 h-5" />,
    },
    {
        href: '/debts',
        label: 'Personal Debt',
        icon: <DollarSign className="w-5 h-5" />,
    },
    {
        href: '/tax-info',
        label: 'Tax Calculator',
        icon: <Calculator className="w-5 h-5" />,
    },
    {
        href: '/settings',
        label: 'Settings',
        icon: <Settings className="w-5 h-5" />,
    },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 backdrop-blur-sm bg-opacity-10 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    "fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <Link href="/" className="flex items-center space-x-2" onClick={onClose}>
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-lg text-foreground">Expense Tracker</span>
                        </Link>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="lg:hidden"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6">
                        <ul className="space-y-2">
                            {navigationItems.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={onClose}
                                        className={cn(
                                            "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                            pathname === item.href
                                                ? "bg-primary text-primary-foreground"
                                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                        )}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 text-center">
                            © 2026 Expense Tracker
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}