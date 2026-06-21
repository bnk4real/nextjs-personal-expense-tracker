'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    TrendingUp,
    Tag,
    Wallet,
    Repeat,
    DollarSign,
    Calculator,
    Settings,
    X,
    FileText,
    MessageCircle,
    ChevronDown,
    ChevronRight,
    BarChart3,
    Upload
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

interface NavigationItem {
    href?: string;
    label: string;
    icon: React.ReactNode;
    subItems?: NavigationItem[];
}

const navigationItems: NavigationItem[] = [
    {
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
        subItems: [
            {
                href: '/',
                label: 'Overview',
                icon: <BarChart3 className="w-4 h-4" />,
            },
            {
                href: '/dashboard',
                label: 'Full Dashboard',
                icon: <LayoutDashboard className="w-4 h-4" />,
            },
        ],
    },
    {
        href: '/earnings',
        label: 'Spending',
        icon: <TrendingUp className="w-5 h-5" />,
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
        href: '/imports',
        label: 'Imports',
        icon: <Upload className="w-5 h-5" />,
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
        label: 'Reports',
        icon: <FileText className="w-5 h-5" />,
        subItems: [
            {
                href: '/reports',
                label: 'Generate Reports',
                icon: <FileText className="w-4 h-4" />,
            },
            {
                href: '/dashboard?tab=reports',
                label: 'View Reports',
                icon: <BarChart3 className="w-4 h-4" />,
            },
        ],
    },
    {
        href: '/chatbot',
        label: 'AI Assistant',
        icon: <MessageCircle className="w-5 h-5" />,
    },
    {
        href: '/settings',
        label: 'Settings',
        icon: <Settings className="w-5 h-5" />,
    },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpanded = (label: string) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(label)) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    };

    const isItemActive = (href: string) => {
        return pathname === href;
    };

    const isSubItemActive = (subItems: NavigationItem[]) => {
        return subItems.some(item => item.href && isItemActive(item.href));
    };

    const renderNavigationItem = (item: NavigationItem, level: number = 0) => {
        const hasSubItems = item.subItems && item.subItems.length > 0;
        const isExpanded = expandedItems.has(item.label);
        const isActive = item.href ? isItemActive(item.href) : isSubItemActive(item.subItems || []);

        if (hasSubItems) {
            return (
                <li key={item.label}>
                    <button
                        onClick={() => toggleExpanded(item.label)}
                        className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-lg font-medium transition-colors",
                            isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        )}
                    >
                        <div className="flex items-center space-x-3">
                            {item.icon}
                            <span>{item.label}</span>
                        </div>
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </button>
                    {isExpanded && (
                        <ul className="ml-4 mt-1 space-y-1">
                            {item.subItems!.map((subItem) => renderNavigationItem(subItem, level + 1))}
                        </ul>
                    )}
                </li>
            );
        }

        return (
            <li key={item.href}>
                <Link
                    href={item.href!}
                    onClick={onClose}
                    className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-lg text-lg font-medium transition-colors",
                        isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                >
                    {item.icon}
                    <span>{item.label}</span>
                </Link>
            </li>
        );
    };

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
                            <span className="font-bold text-lg text-foreground">SubTracker</span>
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
                            {navigationItems.map((item) => renderNavigationItem(item))}
                        </ul>
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 text-center">
                            © {new Date().getFullYear()} SubTracker
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
