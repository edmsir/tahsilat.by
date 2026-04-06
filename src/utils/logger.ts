import { supabase } from '../lib/supabase';

export type LogActionType = 
  | 'TOPLU_AKTARIM' 
  | 'KAYIT_OLUSTURMA' 
  | 'KAYIT_DUZENLEME' 
  | 'KAYIT_SILME' 
  | 'LOGIN' 
  | 'LOGOUT'
  | 'HATA';

interface LogData {
  userId?: string | null;
  subeAdi?: string | null;
  action: LogActionType;
  details: any;
}

/**
 * Audit Logger - Kritik kullanıcı işlemlerini veritabanına kaydeder.
 * Cihaz bilgisini otomatik çeker.
 */
export async function logAction({ userId, subeAdi, action, details }: LogData) {
  try {
    const deviceInfo = navigator.userAgent;
    
    const { error } = await supabase.from('islem_loglari').insert({
      user_id: userId,
      sube_adi: subeAdi,
      islem_tipi: action,
      detaylar: details,
      cihaz_bilgisi: deviceInfo,
    });

    if (error) {
       console.error('Audit Log hatası:', error.message);
    }
  } catch (err) {
    console.error('Audit Log kritik hata:', err);
  }
}
