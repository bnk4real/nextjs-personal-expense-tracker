-- Preserve transaction origin separately from the user-facing ledger records.
-- Nullable target columns allow the same contract to cover expenses, incomes,
-- and transfers while retaining foreign-key integrity.
CREATE TABLE "TransactionProvenance" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "importHash" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "originalDescription" TEXT NOT NULL,
    "rawPayload" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "expenseId" INTEGER,
    "incomeId" INTEGER,
    "transferId" INTEGER,

    CONSTRAINT "TransactionProvenance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TransactionProvenance_single_target_check"
    CHECK (num_nonnulls("expenseId", "incomeId", "transferId") = 1)
);

CREATE UNIQUE INDEX "TransactionProvenance_userId_importHash_key"
ON "TransactionProvenance"("userId", "importHash");

CREATE UNIQUE INDEX "TransactionProvenance_expenseId_key"
ON "TransactionProvenance"("expenseId");

CREATE UNIQUE INDEX "TransactionProvenance_incomeId_key"
ON "TransactionProvenance"("incomeId");

CREATE UNIQUE INDEX "TransactionProvenance_transferId_key"
ON "TransactionProvenance"("transferId");

CREATE UNIQUE INDEX "TransactionProvenance_userId_source_externalId_key"
ON "TransactionProvenance"("userId", "source", "externalId");

CREATE INDEX "TransactionProvenance_userId_importedAt_idx"
ON "TransactionProvenance"("userId", "importedAt");

CREATE INDEX "TransactionProvenance_sourceType_source_idx"
ON "TransactionProvenance"("sourceType", "source");

ALTER TABLE "TransactionProvenance"
ADD CONSTRAINT "TransactionProvenance_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "people"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionProvenance"
ADD CONSTRAINT "TransactionProvenance_expenseId_fkey"
FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionProvenance"
ADD CONSTRAINT "TransactionProvenance_incomeId_fkey"
FOREIGN KEY ("incomeId") REFERENCES "Income"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionProvenance"
ADD CONSTRAINT "TransactionProvenance_transferId_fkey"
FOREIGN KEY ("transferId") REFERENCES "Transfer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
