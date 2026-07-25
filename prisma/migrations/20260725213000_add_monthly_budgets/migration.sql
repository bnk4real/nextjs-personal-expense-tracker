CREATE TABLE "MonthlyBudget" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "warningThreshold" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BudgetCategoryLimit" (
    "id" SERIAL NOT NULL,
    "budgetId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCategoryLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyBudget_userId_month_key" ON "MonthlyBudget"("userId", "month");
CREATE INDEX "MonthlyBudget_userId_idx" ON "MonthlyBudget"("userId");
CREATE INDEX "MonthlyBudget_month_idx" ON "MonthlyBudget"("month");
CREATE UNIQUE INDEX "BudgetCategoryLimit_budgetId_category_key" ON "BudgetCategoryLimit"("budgetId", "category");
CREATE INDEX "BudgetCategoryLimit_budgetId_idx" ON "BudgetCategoryLimit"("budgetId");

ALTER TABLE "MonthlyBudget"
ADD CONSTRAINT "MonthlyBudget_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "people"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetCategoryLimit"
ADD CONSTRAINT "BudgetCategoryLimit_budgetId_fkey"
FOREIGN KEY ("budgetId") REFERENCES "MonthlyBudget"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
