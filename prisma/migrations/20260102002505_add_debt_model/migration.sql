-- CreateTable
CREATE TABLE "Debt" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "accountNumber" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION,
    "minimumPayment" DOUBLE PRECISION,
    "dueDate" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);
