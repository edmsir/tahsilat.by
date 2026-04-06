import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Kayit } from '../types';

/**
 * Proje genelinde kullanılan merkezi Excel dışa aktarma fonksiyonu.
 * exceljs kütüphanesi ile yüksek performanslı ve formatlı çıktı sağlar.
 */
export async function exportToExcel(records: Kayit[], fileName: string = 'Tahsilat_Raporu') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tahsilatlar');

  // Kolon Başlıklarını Tanımla
  worksheet.columns = [
    { header: 'Tarih', key: 'tarih', width: 15 },
    { header: 'Şube Adı', key: 'sube_adi', width: 15 },
    { header: 'Müşteri Adı', key: 'musteri_adi', width: 25 },
    { header: 'Ödeme Türü', key: 'banka', width: 20 },
    { header: 'Çekim Şubesi', key: 'cekim_subesi', width: 15 },
    { header: 'Taksit', key: 'taksit', width: 10 },
    { header: 'Tutar (TL)', key: 'tutar', width: 15 },
    { header: 'Notlar', key: 'notlar', width: 30 }
  ];

  // Verileri Ekle ve Formatla
  records.forEach(record => {
    const row = worksheet.addRow({
      tarih: record.tarih,
      sube_adi: record.sube_adi,
      musteri_adi: record.musteri_adi,
      banka: record.banka,
      cekim_subesi: record.cekim_subesi,
      taksit: record.taksit,
      tutar: Number(record.tutar),
      notlar: record.notlar || '-'
    });

    // Tutar kolonunu sayısal formatla
    row.getCell('tutar').numFmt = '#,##0.00 "₺"';
  });

  // Başlık Satırını Özelleştir (Premium Görünüm)
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // İndigo tonu
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Excel dosyasını oluştur ve indirt
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${fileName}_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
}
