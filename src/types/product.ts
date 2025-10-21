export interface Product {
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
  width: number;
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
}
