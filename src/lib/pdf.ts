import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CashClosingData {
  closing_date: string;
  total_sales: number;
  cash_total: number;
  transfer_total: number;
  card_total: number;
  sales_count: number;
  notes: string | null;
  profiles?: { full_name: string } | null;
}

export function exportCashClosingPDF(data: CashClosingData) {
  const doc = new jsPDF();
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('sonder', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Todo tu negocio en movimiento', 14, 26);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Corte de Caja', 14, 38);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${new Date(data.closing_date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 46);
  doc.text(`Responsable: ${(data.profiles as { full_name: string } | null)?.full_name ?? '—'}`, 14, 52);

  autoTable(doc, {
    startY: 60,
    head: [['Concepto', 'Monto']],
    body: [
      ['Efectivo', fmt(data.cash_total)],
      ['Transferencia', fmt(data.transfer_total)],
      ['Tarjeta', fmt(data.card_total)],
      ['Total ventas', fmt(data.total_sales)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [217, 119, 6] },
  });

  doc.text(`Número de ventas: ${data.sales_count}`, 14, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10);

  if (data.notes) {
    doc.text(`Notas: ${data.notes}`, 14, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18);
  }

  doc.save(`corte-caja-${data.closing_date}.pdf`);
}

export function exportSalesReportPDF(monthlyData: { month: string; total: number; count: number }[], topProducts: { name: string; qty: number; revenue: number }[]) {
  const doc = new jsPDF();
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('sonder', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Todo tu negocio en movimiento', 14, 26);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Ventas', 14, 38);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 46);

  autoTable(doc, {
    startY: 54,
    head: [['Mes', 'Total', 'Transacciones']],
    body: monthlyData.map(m => [m.month, fmt(m.total), String(m.count)]),
    theme: 'striped',
    headStyles: { fillColor: [217, 119, 6] },
  });

  const startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Top Productos', 14, startY);

  autoTable(doc, {
    startY: startY + 6,
    head: [['#', 'Producto', 'Unidades', 'Ingresos']],
    body: topProducts.map((p, i) => [String(i + 1), p.name, p.qty.toFixed(2), fmt(p.revenue)]),
    theme: 'striped',
    headStyles: { fillColor: [217, 119, 6] },
  });

  doc.save(`reporte-ventas-${new Date().toISOString().slice(0, 10)}.pdf`);
}
