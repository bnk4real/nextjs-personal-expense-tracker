/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('crypto');

const CHASE_IMPORT_SOURCE = 'chase:staging-csv';

const ACCOUNT_TYPES_BY_LAST4 = {
  '2760': 'Bank Account',
  '7857': 'Credit Card',
  '3880': 'Credit Card',
};

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(field);
      field = '';
      continue;
    }

    field += char;
  }

  fields.push(field.replace(/\r$/, ''));
  return fields;
}

function parseMoney(value) {
  const cleaned = String(value || '').replace(/[$,"\s]/g, '');
  if (!cleaned) return null;
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeDescription(description) {
  return String(description || '').trim().replace(/\s+/g, ' ');
}

function makeImportHash({ accountLast4, date, description, amount }) {
  const input = [
    CHASE_IMPORT_SOURCE,
    accountLast4,
    date,
    amount.toFixed(2),
    normalizeDescription(description).toUpperCase(),
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}

function classifyCategory(description, notes) {
  const normalized = `${description} ${notes || ''}`.toUpperCase();
  const rules = [
    ['STARBUCKS', 'Food'],
    ['DOORDASH', 'Food'],
    ['NOODLESPARTY', 'Food'],
    ['RESTA', 'Food'],
    ['COURTYARD', 'Travel'],
    ['FAIRMONT', 'Travel'],
    ['EXPEDIA', 'Travel'],
    ['AMERICAN AIR', 'Travel'],
    ['DOLLAR RAC', 'Travel'],
    ['UBER', 'Transportation'],
    ['VENTRA', 'Transportation'],
    ['SHELL', 'Gas'],
    ['COSTCO', 'Groceries'],
    ['JEWEL', 'Groceries'],
    ['MARIANOS', 'Groceries'],
    ['PARKT TO SHOP', 'Groceries'],
    ['JOONG BOO', 'Groceries'],
    ['TRADER JOE', 'Groceries'],
    ['WALGREENS', 'Health'],
    ['NSUHS', 'Medical'],
    ['SWEDISH', 'Medical'],
    ['PROGRESSIVE', 'Insurance'],
    ['MINT MOBILE', 'Phone'],
    ['GOOGLE', 'Software'],
    ['GITHUB', 'Software'],
    ['VERCEL', 'Software'],
    ['APPLE.COM/BILL', 'Software'],
    ['APPLE STORE', 'Electronics'],
    ['STEAMGAMES', 'Entertainment'],
    ['TARGET', 'Shopping'],
    ['TJ.MAXX', 'Shopping'],
    ['DOLLAR TREE', 'Shopping'],
    ['IKEA', 'Shopping'],
    ['HOMEDepot'.toUpperCase(), 'Home'],
    ['INTEREST CHARGE', 'Interest'],
    ['MEMBERSHIP FEE', 'Fees'],
    ['BCBS HEALTH', 'Insurance'],
  ];

  const match = rules.find(([needle]) => normalized.includes(needle));
  return match ? match[1] : 'Uncategorized';
}

function transactionKind(accountLast4, amount) {
  const accountType = ACCOUNT_TYPES_BY_LAST4[accountLast4] || 'Credit Card';
  if (accountType === 'Credit Card') {
    return amount >= 0 ? 'expense' : 'income';
  }

  return amount < 0 ? 'expense' : 'income';
}

function isTransferLikeTransaction(description, defaultAction) {
  const normalized = normalizeDescription(description).toUpperCase();
  if (defaultAction !== 'import') return true;

  const transferPatterns = [
    'AUTOMATIC PAYMENT',
    'PAYMENT SENT',
    'PAYMENT THANK YOU',
    'PAYMENT TO CHASE CARD',
    'CHASE CREDIT CRD AUTOPAY',
    'ONLINE TRANSFER',
    'ZELLE PAYMENT TO ',
    'ZELLE PAYMENT FROM ',
  ];

  return transferPatterns.some((pattern) => normalized.includes(pattern));
}

function displayAmountForKind(kind, amount) {
  if (kind === 'expense') return Math.abs(amount);
  return Math.abs(amount);
}

function parseChaseStagingCsv(csvText, options = {}) {
  const lines = csvText.split(/\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { transactions: [], skippedRows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const requiredHeaders = ['date', 'description', 'amount', 'account_last4', 'account_name', 'default_action', 'notes'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing Chase staging CSV columns: ${missingHeaders.join(', ')}`);
  }

  const index = Object.fromEntries(headers.map((header, columnIndex) => [header, columnIndex]));
  const transactions = [];
  const skippedRows = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const rowNumber = lineIndex + 1;
    const fields = parseCsvLine(lines[lineIndex]);
    const date = fields[index.date]?.trim();
    const description = normalizeDescription(fields[index.description]);
    const amount = parseMoney(fields[index.amount]);
    const accountLast4 = fields[index.account_last4]?.trim();
    const accountName = fields[index.account_name]?.trim();
    const defaultAction = fields[index.default_action]?.trim() || 'review';
    const notes = fields[index.notes]?.trim() || '';

    if (!date || !description || amount === null || !accountLast4 || !accountName) {
      skippedRows.push({ rowNumber, reason: 'missing-required-field' });
      continue;
    }

    const kind = transactionKind(accountLast4, amount);
    const isTransferLike = isTransferLikeTransaction(description, defaultAction);
    const category = kind === 'expense' ? classifyCategory(description, notes) : null;
    const source = kind === 'income' ? (notes || 'Credit/Payment') : null;

    transactions.push({
      rowNumber,
      date,
      description,
      amount,
      displayAmount: displayAmountForKind(kind, amount),
      accountLast4,
      accountName,
      accountType: options.accountType || ACCOUNT_TYPES_BY_LAST4[accountLast4] || 'Other',
      importSource: CHASE_IMPORT_SOURCE,
      importHash: makeImportHash({ accountLast4, date, description, amount }),
      kind,
      source,
      category,
      isTransferLike,
      selectedByDefault: defaultAction === 'import' && !isTransferLike,
      defaultAction,
      notes,
    });
  }

  return { transactions, skippedRows };
}

module.exports = {
  CHASE_IMPORT_SOURCE,
  parseChaseStagingCsv,
};
