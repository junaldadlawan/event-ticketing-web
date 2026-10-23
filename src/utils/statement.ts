import type { OrganizationFinance, OrgTransaction } from '../api/types';

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csvRow = (...v: (string | number)[]) => v.map(cell).join(',');
const amount = (m: { amount: number }) => (m.amount / 100).toFixed(2);

/** The statement as CSV text: the period's figures, then the transactions that were loaded. */
export function statementCsv(orgName: string, f: OrganizationFinance, transactions: OrgTransaction[]): string {
  const lines = [
    csvRow('Statement', orgName),
    csvRow('Period (UTC days)', `${f.from} to ${f.to}`),
    csvRow('Currency', f.currency),
    '',
    csvRow('Summary', 'Amount'),
    csvRow('Gross sales', amount(f.sales.gross)),
    csvRow('Refunds', amount(f.sales.refunds)),
    csvRow('Platform fee', amount(f.deductions.platformFee)),
    csvRow('Gateway fee', amount(f.deductions.gatewayFee)),
    csvRow('Total earnings', amount(f.income)),
    csvRow('Total paid out', amount(f.paidOut)),
    csvRow('Pending balance (in payouts)', amount(f.inPayouts)),
    csvRow('Available balance (not in a payout yet)', amount(f.owedNotYetInPayout)),
    '',
    csvRow('Date', 'Type', 'Description', 'Event', 'Gross', 'Fees', 'Net', 'Status'),
    ...transactions.map((t) =>
      csvRow(t.occurredAt, t.type, t.description, t.eventTitle ?? '', amount(t.gross), amount(t.fees), amount(t.net), t.status ?? ''),
    ),
  ];
  return lines.join('\r\n');
}

/** Hands the text to the browser as a file download. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
