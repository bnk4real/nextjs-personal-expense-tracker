'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ArrowRightLeft,
    Bot,
    Calculator,
    CreditCard,
    FileText,
    Home,
    Gauge,
    Landmark,
    LayoutDashboard,
    List,
    ReceiptText,
    Repeat,
    Settings,
    Tag,
    Upload,
    WalletCards,
    X,
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

type NavigationItem = {
    href: string;
    label: string;
    helper: string;
    icon: React.ReactNode;
};

const primaryItems: NavigationItem[] = [
    {
        href: '/',
        label: 'Home',
        helper: 'Month workspace',
        icon: <Home className="h-4 w-4" />,
    },
    {
        href: '/dashboard',
        label: 'Financial Analysis',
        helper: 'Deep financial view',
        icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
        href: '/budgets',
        label: 'Budgets',
        helper: 'Monthly spending caps',
        icon: <Gauge className="h-4 w-4" />,
    },
    {
        href: '/subscriptions',
        label: 'Subscriptions',
        helper: 'Recurring costs',
        icon: <Repeat className="h-4 w-4" />,
    },
    {
        href: '/transactions',
        label: 'Ledger',
        helper: 'All money movement',
        icon: <List className="h-4 w-4" />,
    },
    {
        href: '/imports',
        label: 'Imports',
        helper: 'Bank review queue',
        icon: <Upload className="h-4 w-4" />,
    },
    {
        href: '/accounts',
        label: 'Accounts',
        helper: 'Balances and cards',
        icon: <WalletCards className="h-4 w-4" />,
    },
    {
        href: '/reports',
        label: 'Insights',
        helper: 'Reports and trends',
        icon: <FileText className="h-4 w-4" />,
    },
    {
        href: '/chatbot',
        label: 'AI',
        helper: 'Session analysis',
        icon: <Bot className="h-4 w-4" />,
    },
    {
        href: '/settings',
        label: 'Settings',
        helper: 'Profile and app',
        icon: <Settings className="h-4 w-4" />,
    },
];

const toolItems: NavigationItem[] = [
    {
        href: '/transfers',
        label: 'Transfers',
        helper: 'Move money',
        icon: <ArrowRightLeft className="h-4 w-4" />,
    },
    {
        href: '/categories',
        label: 'Categories',
        helper: 'Spend labels',
        icon: <Tag className="h-4 w-4" />,
    },
    {
        href: '/earnings',
        label: 'Spending',
        helper: 'Legacy expense views',
        icon: <ReceiptText className="h-4 w-4" />,
    },
    {
        href: '/debts',
        label: 'Debt',
        helper: 'Personal loans',
        icon: <CreditCard className="h-4 w-4" />,
    },
    {
        href: '/tax-info',
        label: 'Tax',
        helper: 'Calculator',
        icon: <Calculator className="h-4 w-4" />,
    },
];

function isActivePath(pathname: string, href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, active, onClose }: { item: NavigationItem; active: boolean; onClose: () => void }) {
    return (
        <Link
            href={item.href}
            onClick={onClose}
            className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                active
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
            )}
        >
            <span className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                active ? 'border-white/15 bg-white/10' : 'border-zinc-200 bg-white text-zinc-500 group-hover:text-zinc-950'
            )}>
                {item.icon}
            </span>
            <span className="min-w-0">
                <span className="block truncate font-medium">{item.label}</span>
                <span className={cn('block truncate text-xs', active ? 'text-white/65' : 'text-zinc-500')}>{item.helper}</span>
            </span>
        </Link>
    );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside
                className={cn(
                    'fixed left-0 top-0 z-50 h-full w-64 border-r border-zinc-200 bg-[#f8f9fb] transition-transform duration-300 ease-in-out lg:translate-x-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
                        <Link href="/" className="flex items-center gap-3" onClick={onClose}>
                            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 text-white">
                                <Landmark className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold leading-none text-zinc-950">SubTracker</p>
                                <p className="mt-1 text-xs text-zinc-500">Personal ledger</p>
                            </div>
                        </Link>
                        <Button variant="ghost" size="icon-sm" onClick={onClose} className="lg:hidden">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
                        <div className="space-y-1">
                            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-normal text-zinc-400">Workspace</p>
                            {primaryItems.map((item) => (
                                <SidebarLink
                                    key={item.href}
                                    item={item}
                                    active={isActivePath(pathname, item.href)}
                                    onClose={onClose}
                                />
                            ))}
                        </div>

                        <div className="space-y-1">
                            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-normal text-zinc-400">Tools</p>
                            {toolItems.map((item) => (
                                <SidebarLink
                                    key={item.href}
                                    item={item}
                                    active={isActivePath(pathname, item.href)}
                                    onClose={onClose}
                                />
                            ))}
                        </div>
                    </nav>

                    <div className="border-t border-zinc-200 p-4">
                        <div className="rounded-md border border-zinc-200 bg-white p-3">
                            <p className="text-sm font-medium text-zinc-950">Review first</p>
                            <p className="mt-1 text-xs leading-5 text-zinc-500">Imports and AI drafts should always be confirmed before they affect the ledger.</p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
