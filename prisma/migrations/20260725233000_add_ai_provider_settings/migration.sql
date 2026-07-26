CREATE TABLE "AiProviderSetting" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderSetting_userId_provider_key"
ON "AiProviderSetting"("userId", "provider");

CREATE INDEX "AiProviderSetting_userId_idx"
ON "AiProviderSetting"("userId");

ALTER TABLE "AiProviderSetting"
ADD CONSTRAINT "AiProviderSetting_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "people"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;
