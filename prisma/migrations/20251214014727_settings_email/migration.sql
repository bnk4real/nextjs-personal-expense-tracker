/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `people` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "people" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "people_email_key" ON "people"("email");
