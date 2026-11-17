import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { FinancePeriodReport, Receipt } from '@workspace/api-client-react';
import { formatJod, formatJordanDate } from '@/components/prime-ui';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sharePdf(title: string, html: string) {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ uri });
  }
}

export function shareFinanceReport(report: FinancePeriodReport) {
  const rows = report.transactions.map((transaction) => `
    <tr>
      <td>${escapeHtml(formatJordanDate(transaction.transactionDate))}</td>
      <td>${escapeHtml(transaction.description)}</td>
      <td>${transaction.kind === 'income' ? 'إيراد' : 'مصروف'}</td>
      <td>${escapeHtml(formatJod(transaction.amountFils))}</td>
    </tr>
  `).join('');
  const html = `
    <html lang="ar" dir="rtl"><meta charset="utf-8" />
      <style>body{font-family:Arial,sans-serif;padding:28px;color:#192921}h1{color:#1f4735}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:right}.summary{padding:16px;background:#f7f6f2;border-radius:12px;line-height:2}</style>
      <h1>Prime Boxing Academy</h1><h2>التقرير المالي</h2>
      <p>من ${escapeHtml(formatJordanDate(report.fromDate))} إلى ${escapeHtml(formatJordanDate(report.toDate))}</p>
      <div class="summary">الإيرادات: ${escapeHtml(formatJod(report.incomeFils))}<br/>المصاريف: ${escapeHtml(formatJod(report.expenseFils))}<br/>صافي النتيجة: ${escapeHtml(formatJod(report.netFils))}<br/>الصندوق: ${escapeHtml(formatJod(report.cashBalanceFils))}<br/>رواتب مستحقة: ${escapeHtml(formatJod(report.payrollOutstandingFils))}</div>
      <table><thead><tr><th>التاريخ</th><th>الوصف</th><th>النوع</th><th>المبلغ</th></tr></thead><tbody>${rows}</tbody></table>
    </html>
  `;
  return sharePdf('تقرير Prime Boxing Academy', html);
}

export function sharePaymentReceipt(receipt: Receipt) {
  const html = `
    <html lang="ar" dir="rtl"><meta charset="utf-8" />
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#192921}.receipt{border:2px solid #dbb961;border-radius:18px;padding:24px}h1{color:#1f4735}p{line-height:1.8}</style>
      <div class="receipt"><h1>Prime Boxing Academy</h1><h2>إيصال دفع</h2>
      <p>رقم الإيصال: ${escapeHtml(receipt.receiptNumber)}</p>
      <p>المشترك: ${escapeHtml(receipt.memberName)}</p>
      <p>رقم الهاتف: ${escapeHtml(receipt.memberPhone)}</p>
      <p>الباقة: ${escapeHtml(receipt.planName)}</p>
      <p>المبلغ: ${escapeHtml(formatJod(receipt.amountFils))}</p>
      <p>طريقة الدفع: ${escapeHtml(receipt.method)}</p>
      <p>التاريخ: ${escapeHtml(formatJordanDate(receipt.createdAt))}</p></div>
    </html>
  `;
  return sharePdf(`إيصال ${receipt.receiptNumber}`, html);
}
