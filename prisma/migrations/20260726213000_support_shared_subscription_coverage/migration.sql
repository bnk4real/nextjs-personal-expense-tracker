ALTER TABLE "subscriptions"
ADD COLUMN "company_coverage_percent" INTEGER NOT NULL DEFAULT 0;

UPDATE "subscriptions"
SET "company_coverage_percent" = CASE
    WHEN "company_paid" = true THEN 100
    ELSE 0
END;

ALTER TABLE "subscriptions"
DROP COLUMN "company_paid";

ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_company_coverage_percent_check"
CHECK ("company_coverage_percent" >= 0 AND "company_coverage_percent" <= 100);
