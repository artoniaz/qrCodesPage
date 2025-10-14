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
  productBaseCode?: string;
}
