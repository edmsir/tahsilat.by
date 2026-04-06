export type Sube = 
  | 'YÖNETİCİ'
  | 'MERKEZ' 
  | 'ANKARA' 
  | 'BURSA' 
  | 'BAYRAMPAŞA' 
  | 'MODOKO' 
  | 'İZMİR' 
  | 'MALZEME';

export type OdemeTuru = 
  | 'NAKİT' 
  | 'HAVALE / EFT' 
  | 'ÇEK' 
  | 'SENET' 
  | 'AKBANK POS' 
  | 'GARANTİ POS' 
  | 'İŞ BANKASI POS' 
  | 'ZİRAAT BANKASI POS' 
  | 'YAPI KREDİ POS' 
  | 'HALKBANK POS' 
  | 'QNB FİNANSBANK POS' 
  | 'DENİZBANK POS'
  | 'KUVEYTTÜRK POS';

export interface Kayit {
  id: string;
  tarih: string;
  sube_adi: Sube;
  musteri_adi: string;
  banka: OdemeTuru;
  cekim_subesi: Sube;
  tutar: number;
  taksit: number;
  notlar?: string;
  created_at: string;
  user_id: string;
  has_pending_request?: boolean;
}

export type TalepTipi = 'DUZENLEME' | 'SILME';
export type TalepDurumu = 'BEKLEMEDE' | 'ONAYLANDI' | 'REDDEDİLDİ';

export interface Talep {
  id: string;
  kayit_id: string;
  tip: TalepTipi;
  yeni_veri: Partial<Kayit> | null;
  durum: TalepDurumu;
  sube_adi: string;
  talep_eden_id: string;
  notlar?: string;
  created_at: string;
  kayitlar?: Kayit; // Joined record data
}

export interface UserMetadata {
  role: 'admin' | 'branch';
  sube: Sube | 'ALL';
}

export interface Hedef {
  id: string;
  sube_adi: Sube;
  hedef_tutar: number;
  ay: number;
  yil: number;
  created_at: string;
}

export interface BankSettings {
  id?: string;
  banka_adi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string | null;
  vade_gun: number;
  komisyon_oranlari: Record<string, number>;
  blokaj_gunleri?: Record<string, number>;
  is_active?: boolean;
  holiday_calculation_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BankHoliday {
  id?: string;
  tarih: string;
  aciklama: string;
}

export interface PaymentPlanItem {
  id?: string;
  kayit_id: string;
  taksit_no: number;
  planlanan_tarih: string;
  net_tutar: number;
  komisyon_tutar: number;
  ana_tutar: number;
  durum: 'BEKLEMEDE' | 'YATTI';
  created_at?: string;
  kayitlar?: Kayit;
}
