# SubTracker Subscription Payment Migration Guide

## Overview
This guide helps you migrate existing subscription payment history into the new recurring payment system.

## What the Migration Does

The migration script will:
1. **Analyze existing subscriptions** - Look at start dates and billing cycles
2. **Calculate past payment dates** - Generate payment history from start date to today
3. **Create payment records** - Add paid payment records for past due dates
4. **Set next payment date** - Update subscription's next payment date
5. **Generate upcoming payment** - Create the next pending payment

## How to Run the Migration

### Option 1: UI Button (Recommended)
1. Go to your Subscriptions page
2. Look for the orange "Import Your Payment History" alert
3. Click "Import Payment History"
4. Wait for the success message

### Option 2: Payment Modal
1. Click the credit card icon on any subscription
2. In the payment modal, click "Migrate Existing Payments"
3. Wait for the migration to complete

### Option 3: API Endpoint
```bash
curl -X POST http://localhost:3000/api/admin/migrate-payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## What Gets Created

### For Each Subscription:
- **Past Payments**: All payments that should have occurred from start date to today
  - Status: `paid`
  - Payment Date: Same as due date (assumes on-time payments)
  - Payment Method: `migrated`
- **Next Payment**: The next upcoming payment
  - Status: `pending`
  - Due Date: Calculated based on billing cycle

### Example:
For a Netflix subscription started on January 1, 2024 (monthly billing):
- Paid payments: Feb 1, Mar 1, Apr 1, ..., Nov 1, 2024
- Next payment: Dec 1, 2024 (pending)

## Safety Features

- **No Duplicates**: Skips subscriptions that already have payment records
- **User-Specific**: Only migrates payments for the authenticated user
- **Preserves Data**: Doesn't modify existing payment records
- **Error Handling**: Provides detailed feedback on migration results

## After Migration

1. **Check Payment History**: Click the credit card icon to see imported payments
2. **Verify Next Dates**: Ensure subscription next payment dates are correct
3. **Review Monthly Costs**: Confirm the monthly cost calculations are accurate

## Troubleshooting

### Migration Not Showing
- The alert only appears for subscriptions older than 30 days
- You can still access migration via the payment modal

### Incorrect Payment Dates
- Check the subscription's start date
- Verify the billing cycle is correct
- Re-run migration after fixing subscription details

### Partial Migration
- The script is designed to be safe and re-runnable
- You can run it multiple times without creating duplicates

## Manual Adjustments

If the automatic migration doesn't match your actual payment history:
1. Delete incorrect payment records via the payment modal
2. Manually add individual payments with correct dates
3. Mark payments as paid/unpaid as needed

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your subscription start dates and billing cycles
3. Contact support with the migration results details
