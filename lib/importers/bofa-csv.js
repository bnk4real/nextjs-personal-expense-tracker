/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('crypto');

const BOFA_IMPORT_SOURCE = 'bofa:csv';

function parseMoney(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/[$,"\s]/g, '');
  if (!cleaned) return null;
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function parseBofaDate(value) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (!fieldStarted) {
        inQuotes = true;
        fieldStarted = true;
        continue;
      }

      if (inQuotes && next === '"') {
        field += '"';
        i++;
        continue;
      }

      if (inQuotes && (next === ',' || next === undefined || next === '\r')) {
        inQuotes = false;
        continue;
      }
    }

    if (char === ',' && !inQuotes) {
      fields.push(field);
      field = '';
      fieldStarted = false;
      continue;
    }

    fieldStarted = true;
    field += char;
  }

  fields.push(field.replace(/\r$/, ''));
  return fields;
}

function normalizeDescription(description) {
  return description.trim().replace(/\s+/g, ' ');
}

function makeImportHash({ accountName, date, description, amount, runningBalance }) {
  const input = [
    BOFA_IMPORT_SOURCE,
    accountName,
    date,
    amount.toFixed(2),
    runningBalance === null ? '' : runningBalance.toFixed(2),
    normalizeDescription(description).toUpperCase(),
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}

function classifyTransaction(description, amount) {
  const normalized = description.toUpperCase();
  const isTransferLike =
    normalized.includes('ZELLE PAYMENT TO ') ||
    normalized.includes('ZELLE PAYMENT FROM ') ||
    normalized.includes('DES:E-PAYMENT') ||
    normalized.includes('ONLINE PAYMENT') ||
    normalized.includes('CREDIT CARD PMT');

  if (amount > 0) {
    if (normalized.includes('PAYROLL') || normalized.includes('DIRECT DEP')) {
      return { kind: 'income', source: 'Salary', category: null, isTransferLike };
    }
    if (isTransferLike) {
      return { kind: 'income', source: 'Transfer', category: null, isTransferLike };
    }
    return { kind: 'income', source: 'Other', category: null, isTransferLike };
  }

  const categoryRules = [
    ['DOORDASH', 'Food'],
    ['JEWEL', 'Groceries'],
    ['WALGREENS', 'Health'],
    ['SHELL', 'Gas'],
    ['VENTRA', 'Transportation'],
    ['PARK CHICAGO', 'Parking'],
    ['METROPOLIS PARKIN', 'Parking'],
    ['IPASS', 'Transportation'],
    ['COMED', 'Utilities'],
    ['TMOBILE', 'Phone'],
    ['SHINEPAY LAUNDRY', 'Laundry'],
    ['OPENAI', 'Software'],
    ['CLAUDE.AI', 'Software'],
    ['APPLE.COM/BILL', 'Software'],
    ['NVIDIA', 'Software'],
    ['IRS ', 'Tax'],
    ['IL DEPT OF REVEN', 'Tax'],
    ['FREETAXUSACOM', 'Tax'],
    ['GROUPFOX', 'Rent'],
    ['PL*GROUPFOX', 'Rent'],
    ['MONTHLY MAINTENANCE FEE', 'Bank Fee'],
  ];

  if (isTransferLike) {
    return { kind: 'expense', source: null, category: 'Transfer', isTransferLike };
  }

  const match = categoryRules.find(([needle]) => normalized.includes(needle));
  return {
    kind: 'expense',
    source: null,
    category: match ? match[1] : 'Uncategorized',
    isTransferLike,
  };
}

function parseSummaryLine(line) {
  const fields = parseCsvLine(line);
  return {
    label: fields[0] || '',
    amount: parseMoney(fields[2]),
  };
}

function extractSummary(lines) {
  const summary = {
    beginningBalance: null,
    beginningDate: null,
    totalCredits: null,
    totalDebits: null,
    endingBalance: null,
    endingDate: null,
  };

  for (const line of lines.slice(0, 6)) {
    const { label, amount } = parseSummaryLine(line);
    const beginning = label.match(/^Beginning balance as of (\d{2}\/\d{2}\/\d{4})/);
    const ending = label.match(/^Ending balance as of (\d{2}\/\d{2}\/\d{4})/);

    if (beginning) {
      summary.beginningDate = parseBofaDate(beginning[1]);
      summary.beginningBalance = amount;
    } else if (ending) {
      summary.endingDate = parseBofaDate(ending[1]);
      summary.endingBalance = amount;
    } else if (label === 'Total credits') {
      summary.totalCredits = amount;
    } else if (label === 'Total debits') {
      summary.totalDebits = amount;
    }
  }

  return summary;
}

function parseBofaCsv(csvText, options = {}) {
  const accountName = options.accountName || 'Bank of America Checking';
  const lines = csvText.split(/\n/).filter((line) => line.trim().length > 0);
  const headerIndex = lines.findIndex((line) => line.trim() === 'Date,Description,Amount,Running Bal.');

  if (headerIndex === -1) {
    throw new Error('Could not find BoFA transaction header: Date,Description,Amount,Running Bal.');
  }

  const summary = extractSummary(lines);
  const transactions = [];
  const skippedRows = [];

  for (let index = headerIndex + 1; index < lines.length; index++) {
    const rowNumber = index + 1;
    const fields = parseCsvLine(lines[index]);
    const [rawDate, rawDescription, rawAmount, rawRunningBalance] = fields;
    const date = parseBofaDate(rawDate);
    const description = normalizeDescription(rawDescription || '');
    const amount = parseMoney(rawAmount);
    const runningBalance = parseMoney(rawRunningBalance);

    if (!date || amount === null) {
      skippedRows.push({ rowNumber, reason: 'missing-date-or-amount', raw: lines[index] });
      continue;
    }

    if (description.toUpperCase().startsWith('BEGINNING BALANCE AS OF')) {
      skippedRows.push({ rowNumber, reason: 'beginning-balance', raw: lines[index] });
      continue;
    }

    const classification = classifyTransaction(description, amount);
    transactions.push({
      rowNumber,
      date,
      description,
      amount,
      runningBalance,
      importSource: BOFA_IMPORT_SOURCE,
      importHash: makeImportHash({ accountName, date, description, amount, runningBalance }),
      ...classification,
    });
  }

  return { summary, transactions, skippedRows };
}

module.exports = {
  BOFA_IMPORT_SOURCE,
  classifyTransaction,
  parseBofaCsv,
};
