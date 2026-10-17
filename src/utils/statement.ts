import type { OrganizationFinance, OrgTransaction } from '../api/types';

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (...v: (string | number)[]) => v.map(cell).join(',');
const amount = (m: { amount: number }) => (m.amount / 100).toFixed(2);

/** The statement as CSV text: the period's figures, then the transactions that were loaded. */
export function statementCsv(orgName: string, f: OrganizationFinance, transactions: OrgTransaction[]): string {
  const lines = [
    row('Statement', orgName),
    row('Period (UTC days)', `${f.from} to ${f.to}`),
    row('Currency', f.currency),
    '',
    row('Summary', 'Amount'),
    row('Gross sales', amount(f.sales.gross)),
    row('Refunds', amount(f.sales.refunds)),
    row('Platform fee', amount(f.deductions.platformFee)),
    row('Gateway fee', amount(f.deductions.gatewayFee)),
    row('Total earnings', amount(f.income)),
    row('Total paid out', amount(f.paidOut)),
    row('Pending balance (in payouts)', amount(f.inPayouts)),
    row('Available balance (not in a payout yet)', amount(f.owedNotYetInPayout)),
    '',
    row('Date', 'Type', 'Description', 'Event', 'Gross', 'Fees', 'Net', 'Status'),
    ...transactions.map((t) =>
      row(t.occurredAt, t.type, t.description, t.eventTitle ?? '', amount(t.gross), amount(t.fees), amount(t.net), t.status ?? ''),
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
