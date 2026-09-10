const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

function toCsv(report) {
  const rows = report.rows;
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    const str = String(val ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(',')];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(',')));
  return lines.join('\n');
}

async function toExcelBuffer(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FPN Attendance Management System';
  const sheet = workbook.addWorksheet(report.title.slice(0, 30));

  if (report.rows.length > 0) {
    const headers = Object.keys(report.rows[0]);
    sheet.columns = headers.map((h) => ({
      header: h.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      key: h,
      width: 22,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    report.rows.forEach((row) => sheet.addRow(row));
  }

  return workbook.xlsx.writeBuffer();
}

function toPdfBuffer(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fillColor('#0F172A').fontSize(18).font('Helvetica-Bold').text('Federal Polytechnic Nekede', { align: 'center' });
    doc.fillColor('#D4AF37').fontSize(13).text(report.title, { align: 'center' });
    doc.moveDown(1);
    doc.fillColor('#1E293B').fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, {
      align: 'center',
    });
    doc.moveDown(1.5);

    if (report.rows.length === 0) {
      doc.fontSize(11).text('No records found.', { align: 'center' });
      doc.end();
      return;
    }

    const headers = Object.keys(report.rows[0]);
    const colWidth = (doc.page.width - 80) / headers.length;
    let y = doc.y;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.rect(40, y, doc.page.width - 80, 20).fill('#0F172A');
    doc.fillColor('#FFFFFF');
    headers.forEach((h, i) => {
      doc.text(h.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), 40 + i * colWidth + 4, y + 5, {
        width: colWidth - 8,
      });
    });
    y += 20;

    doc.font('Helvetica').fontSize(8.5);
    report.rows.forEach((row, rowIndex) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
      if (rowIndex % 2 === 0) {
        doc.rect(40, y, doc.page.width - 80, 18).fill('#F8FAFC');
      }
      doc.fillColor('#1E293B');
      headers.forEach((h, i) => {
        doc.text(String(row[h] ?? ''), 40 + i * colWidth + 4, y + 4, { width: colWidth - 8 });
      });
      y += 18;
    });

    doc.end();
  });
}

module.exports = { toCsv, toExcelBuffer, toPdfBuffer };
