CREATE UNIQUE INDEX "SubscriptionPayment_subscriptionId_dueDate_key"
ON "SubscriptionPayment"("subscriptionId", "dueDate");
