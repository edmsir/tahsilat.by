import { addDays, format, isWeekend, parseISO } from 'date-fns';

export interface BankSettings {
  banka_adi: string;
  vade_gun: number;
  komisyon_oranlari: Record<string, number>;
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
export function getShiftedDate(date: Date, holidays: string[]): { shiftedDate: Date; isShifted: boolean } {
  let currentDate = new Date(date);
  let isShifted = false;

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
  record: { tarih: string; tutar: number; taksit: number },
  settings: BankSettings,
  holidays: string[]
): PaymentInstallment[] {
  const schedule: PaymentInstallment[] = [];
  const transDate = parseISO(record.tarih);
  const taksitSayisi = record.taksit || 1;
  const komisyonOrani = settings.komisyon_oranlari[taksitSayisi.toString()] || 0;

  const toplamKomisyon = (record.tutar * komisyonOrani) / 100;
  const netToplam = record.tutar - toplamKomisyon;

  const taksitAnaTutar = record.tutar / taksitSayisi;
  const taksitKomisyonTutar = toplamKomisyon / taksitSayisi;
  const taksitNetTutar = netToplam / taksitSayisi;

  // First installment starts after block period (vade_gun)
  let baseDate = addDays(transDate, settings.vade_gun);

  for (let i = 1; i <= taksitSayisi; i++) {
    const { shiftedDate, isShifted } = getShiftedDate(baseDate, holidays);

    schedule.push({
      taksit_no: i,
      planlanan_tarih: format(shiftedDate, 'yyyy-MM-dd'),
      original_tarih: format(baseDate, 'yyyy-MM-dd'),
      net_tutar: Number(taksitNetTutar.toFixed(2)),
      komisyon_tutar: Number(taksitKomisyonTutar.toFixed(2)),
      ana_tutar: Number(taksitAnaTutar.toFixed(2)),
      is_shifted: isShifted
    });

    // Subsequent installments are 30 days after the PREVIOUS BASE date
    baseDate = addDays(baseDate, 30);
  }

  return schedule;
}
