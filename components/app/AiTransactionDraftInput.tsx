'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type TransactionDraft = {
    amount: number;
    category?: string;
    source?: string;
    date: string;
    description: string;
    notes?: string;
    accountId: number | null;
    confidence: number;
};

type AiTransactionDraftInputProps = {
    type: 'expense' | 'income';
    onApply: (draft: TransactionDraft) => void;
};

export function AiTransactionDraftInput({ type, onApply }: AiTransactionDraftInputProps) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const label = type === 'expense' ? 'AI Expense Text' : 'AI Income Text';
    const placeholder = type === 'expense'
        ? 'coffee 6.25 today bofa'
        : 'salary 3000 today chase';

    const handleApply = async () => {
        if (!text.trim() || loading) return;

        setLoading(true);
        try {
            const response = await fetch('/api/ai/transaction-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, text: text.trim() }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create draft');
            }

            onApply(data.draft);
            toast.success(`Filled ${type} draft. Review before saving.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create draft');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Label htmlFor={`ai-${type}-text`}>{label}</Label>
            <Textarea
                id={`ai-${type}-text`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={placeholder}
                rows={2}
            />
            <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={!text.trim() || loading}
                onClick={handleApply}
            >
                <Sparkles className="h-4 w-4" />
                {loading ? 'Filling...' : 'AI Fill Form'}
            </Button>
        </div>
    );
}
