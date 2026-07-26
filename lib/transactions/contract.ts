export const TRANSACTION_KINDS = ['expense', 'income', 'transfer'] as const;
export const TRANSACTION_SOURCE_TYPES = ['manual', 'file_import', 'bank_sync'] as const;

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export type TransactionSourceType = (typeof TRANSACTION_SOURCE_TYPES)[number];

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type TransactionProvenanceContract = {
    sourceType: TransactionSourceType;
    source: string;
    externalId?: string;
    importHash?: string;
    rawPayload?: JsonObject;
};

export type NormalizedTransaction = {
    kind: TransactionKind;
    amountCents: number;
    currency: string;
    date: string;
    description: string;
    originalDescription: string;
    accountId?: number | null;
    category?: string | null;
    incomeSource?: string | null;
    isTransferLike: boolean;
    provenance: TransactionProvenanceContract;
};

type NormalizeTransactionInput = Omit<
    NormalizedTransaction,
    'amountCents' | 'currency' | 'description' | 'originalDescription'
> & {
    amount: number;
    currency?: string;
    description: string;
    originalDescription?: string;
};

function cleanDescription(value: string) {
    return value.trim().replace(/\s+/g, ' ');
}

export function dollarsToCents(amount: number) {
    if (!Number.isFinite(amount)) {
        throw new Error('Transaction amount must be a finite number');
    }

    return Math.round(Math.abs(amount) * 100);
}

export function centsToDollars(amountCents: number) {
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
        throw new Error('Transaction amount must be a non-negative integer number of cents');
    }

    return amountCents / 100;
}

export function normalizeTransaction(input: NormalizeTransactionInput): NormalizedTransaction {
    const description = cleanDescription(input.description);
    const originalDescription = cleanDescription(input.originalDescription ?? input.description);
    const source = input.provenance.source.trim();

    if (!description || !originalDescription) {
        throw new Error('Transaction description is required');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new Error('Transaction date must use YYYY-MM-DD format');
    }

    if (!source) {
        throw new Error('Transaction source is required');
    }

    if (
        input.provenance.sourceType !== 'manual' &&
        !input.provenance.importHash &&
        !input.provenance.externalId
    ) {
        throw new Error('Imported transactions require an import hash or external ID');
    }

    return {
        kind: input.kind,
        amountCents: dollarsToCents(input.amount),
        currency: (input.currency || 'USD').trim().toUpperCase(),
        date: input.date,
        description,
        originalDescription,
        accountId: input.accountId,
        category: input.category,
        incomeSource: input.incomeSource,
        isTransferLike: input.isTransferLike,
        provenance: {
            ...input.provenance,
            source,
            externalId: input.provenance.externalId?.trim() || undefined,
            importHash: input.provenance.importHash?.trim() || undefined,
        },
    };
}

export function provenanceCreateData(userId: string, transaction: NormalizedTransaction) {
    return {
        userId,
        sourceType: transaction.provenance.sourceType,
        source: transaction.provenance.source,
        externalId: transaction.provenance.externalId,
        importHash: transaction.provenance.importHash,
        currency: transaction.currency,
        originalDescription: transaction.originalDescription,
        rawPayload: transaction.provenance.rawPayload,
    };
}
