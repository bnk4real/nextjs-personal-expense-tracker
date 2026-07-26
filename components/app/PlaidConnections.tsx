'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Building2, Link2, RefreshCw, Unlink } from 'lucide-react';
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PlaidAccount = {
    id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
    currentBalance: number | null;
    availableBalance: number | null;
    creditLimit: number | null;
    currency: string | null;
};

type PlaidConnection = {
    id: string;
    institutionName: string | null;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
    autoImportStartDate: string;
    lastSyncedAt: string | null;
    accounts: PlaidAccount[];
};

type ConnectionsResponse = {
    connections: PlaidConnection[];
    reviewCount: number;
    environment: string;
};

function formatMoney(value: number | null, currency: string | null) {
    if (value === null) return '—';
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: currency || 'USD',
    });
}

export function PlaidConnections({ onChanged }: { onChanged: () => void }) {
    const [data, setData] = useState<ConnectionsResponse | null>(null);
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const loadConnections = useCallback(async () => {
        const response = await fetch('/api/plaid/connections');
        if (!response.ok) return;
        setData(await response.json());
    }, []);

    useEffect(() => {
        loadConnections();
    }, [loadConnections]);

    const onSuccess = useCallback(async (
        publicToken: string | null,
        metadata: PlaidLinkOnSuccessMetadata
    ) => {
        if (!publicToken) return;
        setLoading(true);
        try {
            const response = await fetch('/api/plaid/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    publicToken,
                    institution: {
                        institutionId: metadata.institution?.institution_id,
                        name: metadata.institution?.name,
                    },
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to connect account');

            toast.success(`Bank connected — imported ${result.sync.imported} transaction(s)`);
            await loadConnections();
            onChanged();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to connect account');
        } finally {
            setLoading(false);
            setLinkToken(null);
        }
    }, [loadConnections, onChanged]);

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess,
        onExit: (error) => {
            if (error) toast.error(error.display_message || error.error_message || 'Plaid Link closed with an error');
            setLinkToken(null);
        },
    });

    useEffect(() => {
        if (linkToken && ready) open();
    }, [linkToken, open, ready]);

    const connect = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/plaid/link-token', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to start Plaid Link');
            setLinkToken(result.linkToken);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to start Plaid Link');
        } finally {
            setLoading(false);
        }
    };

    const sync = async (connectionId: string) => {
        setSyncingId(connectionId);
        try {
            const response = await fetch('/api/plaid/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connectionId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Sync failed');
            const summary = result.results[0];
            toast.success(`Sync complete — ${summary.imported} imported, ${summary.review} to review`);
            await loadConnections();
            onChanged();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Sync failed');
        } finally {
            setSyncingId(null);
        }
    };

    const disconnect = async (connection: PlaidConnection) => {
        if (!confirm(`Disconnect ${connection.institutionName || 'this institution'} from Plaid? Imported transactions will remain.`)) return;

        const response = await fetch('/api/plaid/connections', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: connection.id }),
        });
        const result = await response.json();
        if (!response.ok) {
            toast.error(result.error || 'Unable to disconnect');
            return;
        }
        toast.success('Plaid connection removed');
        await loadConnections();
    };

    return (
        <Card className="rounded-md border-blue-200 bg-blue-50/40">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Link2 className="h-5 w-5" />
                            Automatic bank sync
                        </CardTitle>
                        {data?.environment && (
                            <Badge variant="outline">{data.environment}</Badge>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Plaid updates account balances and imports posted activity from the connection date forward.
                    </p>
                </div>
                <Button onClick={connect} disabled={loading || Boolean(linkToken)}>
                    <Building2 className="h-4 w-4" />
                    {loading ? 'Connecting…' : 'Connect bank'}
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {data && data.reviewCount > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            {data.reviewCount} pending, transfer, or card-payment transaction{data.reviewCount === 1 ? '' : 's'} held for review to prevent double-counting.
                        </span>
                    </div>
                )}

                {data?.connections.length === 0 && (
                    <p className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                        No bank is connected yet. In Sandbox, choose a test institution and use Plaid&apos;s test credentials.
                    </p>
                )}

                {data?.connections.map((connection) => (
                    <div key={connection.id} className="rounded-md border bg-background p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold">{connection.institutionName || 'Connected institution'}</p>
                                    <Badge variant={connection.status === 'healthy' ? 'secondary' : 'destructive'}>
                                        {connection.status.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Importing activity dated {connection.autoImportStartDate} or later
                                    {connection.lastSyncedAt
                                        ? ` · Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
                                        : ''}
                                </p>
                                {connection.errorMessage && (
                                    <p className="mt-2 text-sm text-red-600">{connection.errorMessage}</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => sync(connection.id)}
                                    disabled={syncingId === connection.id}
                                >
                                    <RefreshCw className={syncingId === connection.id ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                                    Sync now
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => disconnect(connection)}>
                                    <Unlink className="h-4 w-4" />
                                    Disconnect
                                </Button>
                            </div>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {connection.accounts.map((account) => (
                                <div key={account.id} className="flex items-center justify-between gap-4 rounded-md bg-muted/50 px-3 py-2 text-sm">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">
                                            {account.name}{account.mask ? ` ••••${account.mask}` : ''}
                                        </p>
                                        <p className="text-xs capitalize text-muted-foreground">
                                            {account.subtype || account.type}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold tabular-nums">
                                            {formatMoney(account.currentBalance, account.currency)}
                                        </p>
                                        {account.availableBalance !== null && (
                                            <p className="text-xs text-muted-foreground">
                                                Available {formatMoney(account.availableBalance, account.currency)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
