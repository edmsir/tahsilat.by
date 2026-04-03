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
  const taksitSayisi = record.taksit || 1;
  const oranlar = settings.komisyon_oranlari || {};
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
  let baseDate = addDays(transDate, settings.vade_gun);

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
    const { shiftedDate, isShifted } = getShiftedDate(baseDate, holidays);

    schedule.push({
      taksit_no: i,
      planlanan_tarih: format(shiftedDate, 'yyyy-MM-dd'),
      original_tarih: format(baseDate, 'yyyy-MM-dd'),
      net_tutar: instNet,
      komisyon_tutar: instComm,
      ana_tutar: instGross,
      is_shifted: isShifted
    });

    baseDate = addDays(baseDate, 30);
  }

  return schedule;
}
