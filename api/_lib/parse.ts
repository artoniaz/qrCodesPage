// Server-side mirror of the original client-side Airtable record parser.
// Lives here so the API returns a narrow, typed Product projection rather
// than forwarding every Airtable field to the browser.

// The Product shape is duplicated from src/types/product.ts (rather than
// imported across the api/ ↔ src/ boundary) because the Vercel function
// build is independent of the Vite bundle and we don't want the server
// reaching into the SPA source tree.
export interface Product {
  // Discriminates which view the SPA should render. Derived from the record's
  // field-set, NOT from the URL the visitor arrived on — the same record can be
  // reached through /product/:id or /product/front/:id depending on when its QR
  // code was printed.
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
  width?: string;
  width_1?: number;
  width_2?: number;
  width_3?: number;
  width_4?: number;
  width_5?: number;
  width_6?: number;
  width_7?: number;
  width_8?: number;
  height?: number;
  type?: string;
  url: string;
  'url + code': string;
  producer?: string;
  label?: string;
  length?: string;
  length_1?: number;
  length_2?: number;
  side?: number | string;
  price_600_m_1?: number;
  price_635_m_1?: number;
  price_650_m_1?: number;
  price_700_m_1?: number;
  price_800_m_1?: number;
  price_900_m_1?: number;
  price_1200_m_1?: number;
  price_1300_m_1?: number;
  price_600_m_2?: number;
  price_700_m_2?: number;
  price_800_m_2?: number;
  price_900_m_2?: number;
  price_1200_m_2?: number;
  front_typ?: string;
  frez_typ?: string;
  kolor?: string;
  info?: string;
  czas_oczekiwania?: string;
  cena_brutto?: number;
  cena_brutto_laser?: number;
  ukryj_cene?: boolean;
  // Sheet+front schema. The front and the sheet come from different producers
  // and have independent lead times, so neither can collapse into `producer` /
  // `czas_oczekiwania` alone.
  producent_front?: string;
  producent_arkusz?: string;
  arkusz_dlugosc?: number;
  arkusz_szerokosc?: number;
  arkusz_grubosc?: number;
  arkusz_czas_oczekiwania?: string;
  // Priced independently of the front — NOT derived from cena_brutto and the
  // sheet's area. Both numbers come straight from Airtable.
  cena_brutto_arkusz?: number;
  prices?: Record<string, number>;
  sideKeys?: { 1?: string; 2?: string };
  kolekcja?: string;
  qr_id?: string;
  is_new?: boolean;
}

// 'blat'        → Juan / Kronospan worktop, rendered with the price calculator
// 'front'       → front-only record (stylfront, carlack, brw, …)
// 'front_arkusz'→ consolidated sheet+front record ("niemann_frontpol widok
//                 publiczny"): a front made by one producer on a sheet made by
//                 another, so both sets of attributes must be shown together
// 'other'       → plain board / accessory record
export type ProductKind = 'blat' | 'front' | 'front_arkusz' | 'other';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function parsePrice(priceValue: unknown): number | undefined {
  if (priceValue === undefined || priceValue === null) return undefined;
  if (typeof priceValue === 'number') return priceValue;
  if (typeof priceValue === 'string') {
    const cleaned = priceValue.replace('PLN', '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parseLength(lengthValue: unknown): { length_1?: number; length_2?: number } {
  if (typeof lengthValue !== 'string') return {};
  const lengths = lengthValue
    .split(';')
    .map((l) => {
      const parsed = parseInt(l.trim());
      return isNaN(parsed) ? undefined : parsed;
    })
    .filter((l): l is number => l !== undefined);
  return { length_1: lengths[0], length_2: lengths[1] };
}

function parseWidth(widthValue: unknown): {
  width_1?: number;
  width_2?: number;
  width_3?: number;
  width_4?: number;
  width_5?: number;
  width_6?: number;
  width_7?: number;
  width_8?: number;
} {
  if (typeof widthValue !== 'string') return {};
  const widths = widthValue
    .split(';')
    .map((w) => {
      const parsed = parseInt(w.trim());
      return isNaN(parsed) ? undefined : parsed;
    })
    .filter((w): w is number => w !== undefined);
  return {
    width_1: widths[0],
    width_2: widths[1],
    width_3: widths[2],
    width_4: widths[3],
    width_5: widths[4],
    width_6: widths[5],
    width_7: widths[6],
    width_8: widths[7],
  };
}

function parseCenyNetto(value: unknown): Record<string, number> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') return value as Record<string, number>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, number>)
        : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// See client-side comment in original src/services/airtable.ts for the
// semantics. "1" or "0_1" → jednostronnie; "2" → obustronnie.
function parseZaobleniaAndKeys(
  value: unknown,
): { side?: number | string; sideKeys: { 1?: string; 2?: string } } {
  const sideKeys: { 1?: string; 2?: string } = {};
  if (value === undefined || value === null) return { side: undefined, sideKeys };
  const str = String(value).trim();
  if (!str) return { side: undefined, sideKeys };
  const parts = str.split(';').map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (p === '1' || p === '0_1') sideKeys[1] = p;
    else if (p === '2') sideKeys[2] = p;
    // Unknown tokens are intentionally ignored on the server. The original
    // client warned about them; that warning is only useful to a developer
    // inspecting the dataset, not to end users.
  }
  let side: number | string | undefined;
  if (sideKeys[1] && sideKeys[2]) side = '1_2';
  else if (sideKeys[1]) side = 1;
  else if (sideKeys[2]) side = 2;
  return { side, sideKeys };
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(',', '.').trim());
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

export function parseAirtableRecord(record: AirtableRecord): Product {
  const f = record.fields;
  const isNewJuanSchema = f.ceny_netto !== undefined || f.szerokosci !== undefined;

  if (isNewJuanSchema) {
    const parsedLengths = parseLength(f.dlugosci);
    const parsedWidths = parseWidth(f.szerokosci);
    const { side, sideKeys } = parseZaobleniaAndKeys(f.zaoblenia);
    const prices = parseCenyNetto(f.ceny_netto);
    // qr_id may carry a BOM-prefixed key from the CSV import.
    const qrId =
      (f.qr_id as string | undefined) ??
      (f['﻿qr_id'] as string | undefined) ??
      undefined;
    return {
      kind: 'blat',
      id: record.id,
      decor: f.dekor !== undefined && f.dekor !== null ? String(f.dekor) : '',
      structure: (f.struktura as string) || '',
      name: (f.nazwa as string) || '',
      sellUnit: (f.sellUnit as string) || '',
      price: (f.price as number) || 0,
      category: 'blat',
      description: (f.description as string) || '',
      code: (f.code as string) || '',
      thickness:
        typeof f.grubosc === 'number'
          ? f.grubosc
          : parseInt(f.grubosc as string) || 0,
      typePrice: (f.typePrice as string) || '',
      width: (f.szerokosci as string) || undefined,
      width_1: parsedWidths.width_1,
      width_2: parsedWidths.width_2,
      width_3: parsedWidths.width_3,
      width_4: parsedWidths.width_4,
      width_5: parsedWidths.width_5,
      width_6: parsedWidths.width_6,
      width_7: parsedWidths.width_7,
      width_8: parsedWidths.width_8,
      height: undefined,
      type: undefined,
      url: (f.url as string) || '',
      'url + code': (f['url + code'] as string) || '',
      producer: 'Juan',
      label: (f.label as string) || undefined,
      length:
        f.dlugosci !== undefined && f.dlugosci !== null
          ? String(f.dlugosci)
          : undefined,
      length_1: parsedLengths.length_1,
      length_2: parsedLengths.length_2,
      side,
      sideKeys,
      prices,
      kolekcja: (f.kolekcja as string) || undefined,
      qr_id: qrId || undefined,
      is_new: f.is_new === true || f.is_new === 'checked',
      ukryj_cene: f.ukryj_cene === true,
    };
  }

  // Sheet+front schema ("niemann_frontpol widok publiczny"). Detected by the
  // producer split, which is what makes this schema distinct: the sheet and the
  // front it is fronted with come from two different manufacturers.
  const isSheetFrontSchema =
    f.producent_front !== undefined ||
    f.producent_arkusz !== undefined ||
    f.front_czas_oczekiwania !== undefined;

  if (isSheetFrontSchema) {
    const frontProducer = asString(f.producent_front);
    return {
      kind: 'front_arkusz',
      id: record.id,
      decor: '',
      structure: '',
      name: '',
      sellUnit: '',
      price: 0,
      category: '',
      description: '',
      code: '',
      thickness: parseNumber(f.arkusz_grubosc) ?? 0,
      typePrice: '',
      url: (f.url as string) || '',
      'url + code': '',
      // `producer` keeps meaning "who made the thing on the shelf" — the front.
      // The sheet's producer is exposed separately below.
      producer: frontProducer,
      front_typ: asString(f.front_typ),
      frez_typ: asString(f.frez_typ),
      kolor: asString(f.kolor),
      info: asString(f.info),
      // Two independent lead times. `czas_oczekiwania` mirrors the front's so
      // consumers that only know the front schema keep working.
      czas_oczekiwania: asString(f.front_czas_oczekiwania),
      // The sheet+front table splits the price the same way it splits the
      // producer and the lead time: `cena_brutto` mirrors the front's so the
      // shared front rendering keeps working.
      cena_brutto: parsePrice(f.cena_brutto_front),
      cena_brutto_arkusz: parsePrice(f.cena_brutto_arkusz),
      producent_front: frontProducer,
      producent_arkusz: asString(f.producent_arkusz),
      arkusz_dlugosc: parseNumber(f.arkusz_dlugosc),
      // Airtable field is misspelled ("szczerokosc"); normalized here so the
      // typo stops at the API boundary.
      arkusz_szerokosc: parseNumber(f.arkusz_szczerokosc ?? f.arkusz_szerokosc),
      arkusz_grubosc: parseNumber(f.arkusz_grubosc),
      arkusz_czas_oczekiwania: asString(f.arkusz_czas_oczekiwania),
      qr_id: asString(f.id),
      ukryj_cene: f.ukryj_cene === true,
    };
  }

  const parsedLengths = parseLength(f.length);
  const parsedWidths = parseWidth(f.width);
  const category = (f.category as string) || '';
  const kind: ProductKind =
    category.toLowerCase() === 'blat'
      ? 'blat'
      : f.front_typ !== undefined
        ? 'front'
        : 'other';

  return {
    kind,
    id: record.id,
    decor: (f.decor as string) || '',
    structure: (f.structure as string) || '',
    name: (f.name as string) || '',
    sellUnit: (f.sellUnit as string) || '',
    price: (f.price as number) || 0,
    category,
    description: (f.description as string) || '',
    code: (f.code as string) || '',
    thickness: (f.thickness as number) || 0,
    typePrice: (f.typePrice as string) || '',
    width: (f.width as string) || undefined,
    width_1: parsedWidths.width_1,
    width_2: parsedWidths.width_2,
    width_3: parsedWidths.width_3,
    width_4: parsedWidths.width_4,
    width_5: parsedWidths.width_5,
    width_6: parsedWidths.width_6,
    width_7: parsedWidths.width_7,
    width_8: parsedWidths.width_8,
    height: (f.height as number) || undefined,
    type: (f.type as string) || undefined,
    url: (f.url as string) || '',
    'url + code': (f['url + code'] as string) || '',
    producer: (f.producer as string) || undefined,
    label: (f.label as string) || undefined,
    length: asString(f.length),
    length_1: parsedLengths.length_1,
    length_2: parsedLengths.length_2,
    side: (f.side as number | string) || undefined,
    price_600_m_1: parsePrice(f.price_600_m_1),
    price_635_m_1: parsePrice(f.price_635_m_1),
    price_650_m_1: parsePrice(f.price_650_m_1),
    price_700_m_1: parsePrice(f.price_700_m_1),
    price_800_m_1: parsePrice(f.price_800_m_1),
    price_900_m_1: parsePrice(f.price_900_m_1),
    price_1200_m_1: parsePrice(f.price_1200_m_1),
    price_1300_m_1: parsePrice(f.price_1300_m_1),
    price_600_m_2: parsePrice(f.price_600_m_2),
    price_700_m_2: parsePrice(f.price_700_m_2),
    price_800_m_2: parsePrice(f.price_800_m_2),
    price_900_m_2: parsePrice(f.price_900_m_2),
    price_1200_m_2: parsePrice(f.price_1200_m_2),
    front_typ: (f.front_typ as string) || undefined,
    frez_typ: (f.frez_typ as string) || undefined,
    kolor: (f.kolor as string) || undefined,
    info: (f.info as string) || undefined,
    czas_oczekiwania: (f.czas_oczekiwania as string) || undefined,
    cena_brutto: parsePrice(f.cena_brutto),
    cena_brutto_laser: parsePrice(f.cena_brutto_laser),
    ukryj_cene: f.ukryj_cene === true,
  };
}
