CREATE TABLE "PlaidItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "cursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'syncing',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "autoImportStartDate" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaidAccount" (
    "id" UUID NOT NULL,
    "plaidItemId" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "localAccountId" INTEGER,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "mask" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "availableBalance" DOUBLE PRECISION,
    "creditLimit" DOUBLE PRECISION,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaidTransaction" (
    "id" UUID NOT NULL,
    "plaidAccountId" UUID NOT NULL,
    "transactionId" TEXT NOT NULL,
    "pendingTransactionId" TEXT,
    "provenanceId" UUID,
    "date" TEXT NOT NULL,
    "authorizedDate" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "categoryPrimary" TEXT,
    "categoryDetailed" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "rawPayload" JSONB NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaidItem_itemId_key" ON "PlaidItem"("itemId");
CREATE INDEX "PlaidItem_userId_idx" ON "PlaidItem"("userId");
CREATE INDEX "PlaidItem_status_idx" ON "PlaidItem"("status");

CREATE UNIQUE INDEX "PlaidAccount_accountId_key" ON "PlaidAccount"("accountId");
CREATE INDEX "PlaidAccount_plaidItemId_idx" ON "PlaidAccount"("plaidItemId");
CREATE INDEX "PlaidAccount_localAccountId_idx" ON "PlaidAccount"("localAccountId");

CREATE UNIQUE INDEX "PlaidTransaction_transactionId_key" ON "PlaidTransaction"("transactionId");
CREATE UNIQUE INDEX "PlaidTransaction_provenanceId_key" ON "PlaidTransaction"("provenanceId");
CREATE INDEX "PlaidTransaction_plaidAccountId_date_idx" ON "PlaidTransaction"("plaidAccountId", "date");
CREATE INDEX "PlaidTransaction_pendingTransactionId_idx" ON "PlaidTransaction"("pendingTransactionId");
CREATE INDEX "PlaidTransaction_status_idx" ON "PlaidTransaction"("status");

ALTER TABLE "PlaidItem"
ADD CONSTRAINT "PlaidItem_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "people"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaidAccount"
ADD CONSTRAINT "PlaidAccount_plaidItemId_fkey"
FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaidAccount"
ADD CONSTRAINT "PlaidAccount_localAccountId_fkey"
FOREIGN KEY ("localAccountId") REFERENCES "Account"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlaidTransaction"
ADD CONSTRAINT "PlaidTransaction_plaidAccountId_fkey"
FOREIGN KEY ("plaidAccountId") REFERENCES "PlaidAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaidTransaction"
ADD CONSTRAINT "PlaidTransaction_provenanceId_fkey"
FOREIGN KEY ("provenanceId") REFERENCES "TransactionProvenance"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
