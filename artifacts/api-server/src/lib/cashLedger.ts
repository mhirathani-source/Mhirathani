/** Legacy payment/expense/payroll cash mirrors are evidence, not extra cash. */
export function isIndependentCashMovement(row: {referenceType: string | null}) {
  return !["subscription_payment", "financial_transaction", "payroll"].includes(row.referenceType ?? "");
}
export function signedPayment(row: {kind: string; amountFils: number}) {
  return row.kind === "payment" ? row.amountFils : row.kind === "refund" ? -row.amountFils : 0;
}
export function transactionCash(row: {kind: string; amountFils: number}) {
  const signed = row.kind === "income" ? row.amountFils : -row.amountFils;
  return { direction: signed >= 0 ? "in" as const : "out" as const, amountFils: Math.abs(row.amountFils) };
}
