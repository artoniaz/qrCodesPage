// Mirrors api/_lib/parse.ts. 'front_arkusz' is the consolidated sheet+front
// schema — a front made by one producer on a sheet made by another, so the view
// has to show both sets of attributes side by side.
export type ProductKind = 'blat' | 'front' | 'front_arkusz' | 'other';

export interface Product {
  // Which view to render. Derived from the record's fields by the API, not from
  // the URL the visitor arrived on.
  kind: ProductKind;
  id: string;
  decor: string;
  structure: string;
  name: string;
  sellUnit: string;
  price: number;
  category: string;
  description: string;
  code: string;
  thickness: number;
  typePrice: string;
  width?: string; // Semicolon-separated values like "600; 800; 1200"
  width_1?: number; // Parsed from width string
  width_2?: number; // Parsed from width string
  width_3?: number; // Parsed from width string
  width_4?: number; // Parsed from width string
  width_5?: number; // Parsed from width string
  width_6?: number; // Parsed from width string
  width_7?: number; // Parsed from width string
  width_8?: number; // Parsed from width string
  height?: number;
  type?: string;
  url: string;
  "url + code": string;
  producer?: string;
  label?: string;
  // Worktop-specific fields
  length?: string; // Semicolon-separated values like "3050; 4200"
  length_1?: number; // Parsed from length string
  length_2?: number; // Parsed from length string
  side?: number | string; // 1: one-sided, 2: both-sided, "1_2": can be both
  // Price fields for 1-sided (zaoblenie jednostronne)
  price_600_m_1?: number;
  price_635_m_1?: number;
  price_650_m_1?: number;
  price_700_m_1?: number;
  price_800_m_1?: number;
  price_900_m_1?: number;
  price_1200_m_1?: number;
  price_1300_m_1?: number;
  // Price fields for 2-sided (zaoblenie obustronne)
  price_600_m_2?: number;
  price_700_m_2?: number;
  price_800_m_2?: number;
  price_900_m_2?: number;
  price_1200_m_2?: number;
  // Front-specific fields
  front_typ?: string;
  frez_typ?: string;
  kolor?: string;
  info?: string;
  czas_oczekiwania?: string;
  cena_brutto?: number;
  cena_brutto_laser?: number;
  // Sheet+front fields: the front and the sheet it is applied to come from
  // different producers and have independent lead times.
  producent_front?: string;
  producent_arkusz?: string;
  arkusz_dlugosc?: number;
  arkusz_szerokosc?: number;
  arkusz_grubosc?: number;
  arkusz_czas_oczekiwania?: string;
  // Defined in Airtable, not derived from cena_brutto x sheet area.
  cena_brutto_arkusz?: number;
  // Price visibility flag (set in Airtable when prices are being updated)
  ukryj_cene?: boolean;
  // New Juan blaty schema (single consolidated table)
  prices?: Record<string, number>; // "{width}x{length}x{zaobleniaKey}" -> net price per meter
  // Maps the calculator's side selector (1 = jednostronnie, 2 = obustronnie) to the actual
  // string used inside price-map keys. Differs per product: some use "1"/"2", others "0_1"/"2".
  sideKeys?: { 1?: string; 2?: string };
  kolekcja?: string;
  qr_id?: string;
  is_new?: boolean;
}
