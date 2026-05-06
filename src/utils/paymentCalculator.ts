import { addDays, format, isWeekend, parseISO } from 'date-fns';

export interface BankSettings {
  banka_adi: string;
  vade_gun: number;
  komisyon_oranlari: Record<string, number>;
  blokaj_gunleri?: Record<string, number>;
  holiday_calculation_active?: boolean;
}

export interface PaymentInstallment {
  taksit_no: number;
  planlanan_tarih: string;
  net_tutar: number;
  komisyon_tutar: number;
  ana_tutar: number;
  is_shifted: boolean;
  original_tarih: string;
}

/**
 * Shifts a date to the next available business day if it's a weekend or a holiday.
 */
export function getShiftedDate(date: Date, holidays: string[], active: boolean = true): { shiftedDate: Date; isShifted: boolean } {
  let currentDate = new Date(date);
  let isShifted = false;

  if (!active) {
    return { shiftedDate: currentDate, isShifted: false };
  }

  const isHoliday = (d: Date) => holidays.includes(format(d, 'yyyy-MM-dd'));

  while (isWeekend(currentDate) || isHoliday(currentDate)) {
    currentDate = addDays(currentDate, 1);
    isShifted = true;
  }

  return { shiftedDate: currentDate, isShifted };
}

/**
 * Generates a payment schedule for a POS record based on bank settings and holidays.
 */
export function generatePaymentSchedule(
  record: { tarih: string; tutar: number; taksit: number; banka: string },
  settings: BankSettings,
  holidays: string[]
): PaymentInstallment[] {
  const schedule: PaymentInstallment[] = [];
  const taksitSayisi = record.taksit || 1;
  const oranlar = settings.komisyon_oranlari || {};
  const blokajlar = settings.blokaj_gunleri || {};
  const komisyonOrani = oranlar[taksitSayisi.toString()] ?? oranlar[taksitSayisi] ?? 0;

  // Toplam Tutar ve Toplam Komisyon
  const totalGross = Number(record.tutar.toFixed(2));
  const totalComm = Number(((totalGross * Number(komisyonOrani)) / 100).toFixed(2));

  // Taksit başına (Yuvarlanmış)
  const baseTaksitGross = Number((totalGross / taksitSayisi).toFixed(2));
  const baseTaksitComm = Number((totalComm / taksitSayisi).toFixed(2));

  let runningGross = 0;
  let runningComm = 0;

  const transDate = parseISO(record.tarih);
  if (isNaN(transDate.getTime())) {
    throw new Error(`${record.banka} için geçersiz çekim tarihi: ${record.tarih}`);
  }

  let currentDate = transDate;

  for (let i = 1; i <= taksitSayisi; i++) {
    let instGross: number;
    let instComm: number;

    if (i === taksitSayisi) {
      // Son taksit: Kalan bakiye (Kuruş tamamlama)
      instGross = Number((totalGross - runningGross).toFixed(2));
      instComm = Number((totalComm - runningComm).toFixed(2));
    } else {
      // Ara taksitler
      instGross = baseTaksitGross;
      instComm = baseTaksitComm;
      runningGross += instGross;
      runningComm += instComm;
    }

    const instNet = Number((instGross - instComm).toFixed(2));
    
    // Blokaj Günü Hesaplama
    // TAKSİTLİ: Her taksit için ayrı vade (Varsayılan 30 gün arayla)
    // TEK_SEFER: Tüm taksitler tek bir tarihte (vade_gun kadar sonra) yatar
    const isSinglePayout = settings.odeme_tipi === 'TEK_SEFER';
    
    let offset: number;
    if (isSinglePayout) {
      // Tek seferde ödemede sadece ilk adımda vade_gun kadar eklenir, diğerlerinde eklenmez
      offset = i === 1 ? (settings.vade_gun || 0) : 0;
    } else {
      offset = Number(blokajlar[i.toString()] ?? blokajlar[i] ?? (i === 1 ? (settings.vade_gun || 0) : 30));
    }
    
    if (isNaN(offset)) {
       throw new Error(`${record.banka} için ${i}. taksit vade günü (vade_gun) ayarı hatalı.`);
    }

    currentDate = addDays(currentDate, offset);
    if (isNaN(currentDate.getTime())) {
        throw new Error(`${record.banka} için hesaplanan ${i}. taksit tarihi geçersiz.`);
    }

    const { shiftedDate, isShifted } = getShiftedDate(currentDate, holidays, settings.holiday_calculation_active !== false);

    if (isNaN(shiftedDate.getTime())) {
        throw new Error(`${record.banka} için tatil/haftasonu kaydırması sonrası tarih geçersiz oldu.`);
    }

    schedule.push({
      taksit_no: i,
      planlanan_tarih: format(shiftedDate, 'yyyy-MM-dd'),
      original_tarih: format(currentDate, 'yyyy-MM-dd'),
      net_tutar: instNet,
      komisyon_tutar: instComm,
      ana_tutar: instGross,
      is_shifted: isShifted
    });
  }

  return schedule;
}
