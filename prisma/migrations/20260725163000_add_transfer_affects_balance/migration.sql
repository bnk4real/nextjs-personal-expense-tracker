-- Existing transfers were converted from historical expenses without changing
-- account balances. Keep them display-only unless a new manual transfer opts in.
ALTER TABLE "Transfer" ADD COLUMN "affectsBalance" BOOLEAN NOT NULL DEFAULT false;
