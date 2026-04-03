import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Kayit } from '../types';
import { format } from 'date-fns';

export async function exportToExcel(records: Kayit[], customFilename?: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Şube Tahsilat Kayıtları');

  // Define columns
  worksheet.columns = [
    { header: 'Tarih', key: 'tarih', width: 15 },
    { header: 'Şube Adı', key: 'sube_adi', width: 20 },
    { header: 'Müşteri / Cari Adı', key: 'musteri_adi', width: 30 },
    { header: 'Ödeme Türü / Banka', key: 'banka', width: 25 },
    { header: 'Çekim Şubesi', key: 'cekim_subesi', width: 20 },
    { header: 'Tutar (TL)', key: 'tutar', width: 15 },
    { header: 'Taksit', key: 'taksit', width: 10 },
    { header: 'Not / Açıklama', key: 'not', width: 40 },
  ];

  // Style header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' }, // Indigo-500
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Add records
  records.forEach((record) => {
    const row = worksheet.addRow({
      tarih: format(new Date(record.tarih), 'dd.MM.yyyy'),
      sube_adi: record.sube_adi,
      musteri_adi: record.musteri_adi,
      banka: record.banka,
      cekim_subesi: record.cekim_subesi,
      tutar: record.tutar,
      taksit: record.taksit,
      not: record.notlar || '',
    });

    // Formatting
    row.getCell('tutar').numFmt = '#,##0.00 "TL"';
    row.getCell('taksit').alignment = { horizontal: 'center' };
  });

  // Add borders
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (rowNumber > 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Generate and save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = customFilename || `Sube_Tahsilat_Raporu_${format(new Date(), 'dd_MM_yyyy_HH_mm')}`;
  saveAs(blob, `${filename}.xlsx`);
}
