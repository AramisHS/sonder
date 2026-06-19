import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);

let logoBase64: string | null = null;

const loadLogo = async (): Promise<string | null> => {
  if (logoBase64) return logoBase64;
  try {
    const response = await fetch('/images/sonder-logo.png');
    if (!response.ok) throw new Error('Logo no encontrado');
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    logoBase64 = dataUrl;
    return dataUrl;
  } catch (error) {
    console.warn('No se pudo cargar el logo:', error);
    return null;
  }
};

const addHeaderFooter = (doc: jsPDF, pageNumber: number, totalPages: number, logo: string | null) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (pageNumber === 1) {
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', 14, 10, 30, 30);
      } catch (e) { /* ignorar */ }
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor('#64748b');
    doc.text('Todo tu negocio en movimiento', 50, 22);

    doc.setDrawColor('#b8860b');
    doc.setLineWidth(0.8);
    doc.line(14, 42, pageWidth - 14, 42);
  }

  const footerText = `© ${new Date().getFullYear()} sonder - Todos los derechos reservados`;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#94a3b8');
  doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
};

export async function exportSalesReportPDF(
  monthlyData: { month: string; total: number; count: number }[],
  topProducts: { name: string; qty: number; revenue: number }[]
) {
  const doc = new jsPDF();
  const totalPages = 1;
  const logo = await loadLogo();

  addHeaderFooter(doc, 1, totalPages, logo);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#0b3b4c');
  doc.text('Reporte de Ventas', 14, 54);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#64748b');
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Generado: ${dateStr}`, 14, 62);

  autoTable(doc, {
    startY: 70,
    head: [['Mes', 'Total', 'Transacciones']],
    body: monthlyData.map((m) => [m.month, fmt(m.total), String(m.count)]),
    theme: 'striped',
    headStyles: {
      fillColor: [11, 59, 76],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: 'center',
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center' },
      1: { halign: 'right' },
      2: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
  });

  const finalY = (doc as any).lastAutoTable.finalY || 80;

  const topStartY = finalY + 14;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#0b3b4c');
  doc.text('Top Productos', 14, topStartY);

  autoTable(doc, {
    startY: topStartY + 4,
    head: [['#', 'Producto', 'Unidades', 'Ingresos']],
    body: topProducts.map((p, i) => [
      String(i + 1),
      p.name,
      p.qty.toFixed(2),
      fmt(p.revenue),
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: [11, 59, 76],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: 'center',
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left' },
      2: { halign: 'center' },
      3: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
  });

  const fileName = `reporte-ventas-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

export async function exportCashClosingPDF(data: {
  closing_date: string;
  total_sales: number;
  cash_total: number;
  transfer_total: number;
  card_total: number;
  sales_count: number;
  notes: string | null;
  profiles?: { full_name: string } | null;
}) {
  const doc = new jsPDF();
  const totalPages = 1;
  const logo = await loadLogo();

  addHeaderFooter(doc, 1, totalPages, logo);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#0b3b4c');
  doc.text('Corte de Caja', 14, 54);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#64748b');
  const dateObj = new Date(data.closing_date + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Fecha: ${dateStr}`, 14, 62);
  doc.text(`Responsable: ${(data.profiles as { full_name: string } | null)?.full_name ?? '—'}`, 14, 68);

  autoTable(doc, {
    startY: 76,
    head: [['Concepto', 'Monto']],
    body: [
      ['Efectivo', fmt(data.cash_total)],
      ['Transferencia', fmt(data.transfer_total)],
      ['Tarjeta', fmt(data.card_total)],
      ['Total ventas', fmt(data.total_sales)],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [11, 59, 76],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
  });

  const finalY = (doc as any).lastAutoTable.finalY || 80;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#0b3b4c');
  doc.text(`Número de ventas: ${data.sales_count}`, 14, finalY + 10);

  if (data.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#64748b');
    doc.text(`Notas: ${data.notes}`, 14, finalY + 18);
  }

  const fileName = `corte-caja-${data.closing_date}.pdf`;
  doc.save(fileName);
}