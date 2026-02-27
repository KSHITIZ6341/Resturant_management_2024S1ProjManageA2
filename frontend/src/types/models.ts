export interface Customer {
  id?: string;
  name: string;
  email: string;
  price_lunch: number;
  price_dinner: number;
  price_kids: number;
  phone: string;
  address: string;
  additional_info: string;
}

export interface MenuItemRecord {
  id?: string;
  category: 'ENTREE' | 'MAIN' | 'DESSERT';
  name: string;
}

export interface OrderLine {
  quantity: number;
}

export interface OrderRecord {
  id: number;
  customer_id?: string;
  customer_name: string;
  order_number: string;
  service_type: string;
  adults: number;
  kids: number;
  arrival_time?: string;
  order_date: string;
  order_data?: Record<string, OrderLine>;
  order_docx_path?: string;
  order_pdf_path?: string;
}
