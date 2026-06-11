import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyName } from '@/lib/assets/qr-code';

export type ExportColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

export type ExportOptions<T> = {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  dateRange?: { from?: string; to?: string };
};

function companyHeader() {
  return getCompanyName();
}

function buildMatrix<T>(options: ExportOptions<T>) {
  const headers = options.columns.map((c) => c.header);
  const body = options.rows.map((row) =>
    options.columns.map((c) => {
      const v = c.accessor(row);
      return v == null ? '' : String(v);
    })
  );
  return { headers, body };
}

export function exportToCsv<T>(options: ExportOptions<T>) {
  const { headers, body } = buildMatrix(options);
  const lines = [
    `"${companyHeader()} — ${options.title}"`,
    options.dateRange?.from || options.dateRange?.to
      ? `"Period: ${options.dateRange.from ?? '…'} to ${options.dateRange.to ?? '…'}"`
      : `"Generated: ${new Date().toLocaleString()}"`,
    '',
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...body.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
  ];
  downloadBlob(
    new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }),
    `${options.filename}.csv`
  );
}

export function exportToExcel<T>(options: ExportOptions<T>) {
  const { headers, body } = buildMatrix(options);
  const sheetData = [
    [companyHeader()],
    [options.title],
    [options.dateRange?.from ? `From: ${options.dateRange.from}` : `Generated: ${new Date().toLocaleString()}`],
    [],
    headers,
    ...body,
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${options.filename}.xlsx`);
}

export function exportToPdf<T>(options: ExportOptions<T>) {
  const { headers, body } = buildMatrix(options);
  const doc = new jsPDF({ orientation: body[0]?.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(companyHeader(), 14, 16);
  doc.setFontSize(11);
  doc.text(options.title, 14, 24);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    options.dateRange?.from
      ? `Period: ${options.dateRange.from} — ${options.dateRange.to ?? 'present'}`
      : `Generated: ${new Date().toLocaleString()}`,
    14,
    30
  );
  autoTable(doc, {
    head: [headers],
    body,
    startY: 36,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [124, 58, 237] },
  });
  doc.save(`${options.filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
