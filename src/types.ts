export type Priority = 'High' | 'Medium' | 'Low';
export type Status = string;
export type CallStatus = 
  | 'Picked' 
  | 'Not Picked' 
  | 'Busy' 
  | 'Switched Off'
  | 'Rescheduled'
  | 'Wrong Number'
  | 'Waiting';

export interface FollowUpHistory {
  status: Status | '';
  call: CallStatus | '';
  date: string;
  note: string;
  updatedAt: string;
}

export interface FollowUp {
  id?: string; // Standard DB identifier
  orderId: string; // The merchant's order ID
  consignmentId: string; // Pathao tracking ID (PT...)
  phone: string; // Customer phone number
  product: string; // From Column H
  total: number; // From Column K
  internalId: string; // Unique UUID for the record
  userId: string; // Auth UID
  priority: Priority | '';
  date: string; // ISO date string
  status: Status | '';
  call: CallStatus | '';
  callCount: number;
  isMarked?: boolean;
  note: string;
  raiderCall: CallStatus | '';
  raiderNote: string;
  history?: FollowUpHistory[];
  createdAt: string;
  updatedAt: string;
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low: 'bg-green-100 text-green-700 border-green-200',
};

export const ALL_STATUSES: Status[] = [
  'Pending',
  'At Sorting',
  'At Sorting Hub',
  'Assigned for Delivery',
  'Assigned For Delivery',
  'At Delivery Hub',
  'In Transit',
  'On Hold',
  'Return Requested',
  'Reattempt Requested',
  'Delivery',
  'Delivered',
  'Partial Delivery',
  'Exchange',
  'Returned',
  'Paid Return',
  'Returned To Inventory',
  'Return In Transit',
  'Return At Sorting',
  'Return At Sorting Hub',
  'Assigned for return',
  'First Mile Hub',
  'Return To Merchant',
  'At Inventory',
  'Lost'
];

export const STATUS_COLORS: Record<Status, string> = {
  Pending: 'bg-blue-50 text-blue-700 border-blue-200',
  'At Sorting': 'bg-slate-50 text-slate-700 border-slate-200',
  'At Sorting Hub': 'bg-slate-50 text-slate-700 border-slate-200',
  'Assigned for Delivery': 'bg-teal-50 text-teal-700 border-teal-200',
  'Assigned For Delivery': 'bg-teal-50 text-teal-700 border-teal-200',
  'At Delivery Hub': 'bg-violet-50 text-violet-700 border-violet-200',
  'In Transit': 'bg-sky-50 text-sky-700 border-sky-200',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  'Return Requested': 'bg-pink-50 text-pink-700 border-pink-200',
  'Reattempt Requested': 'bg-orange-100 text-orange-800 border-orange-300',
  Delivery: 'bg-green-50 text-green-700 border-green-200',
  Delivered: 'bg-green-50 text-green-700 border-green-200',
  'Partial Delivery': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Exchange: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Returned: 'bg-rose-50 text-rose-700 border-rose-200',
  Return: 'bg-rose-50 text-rose-700 border-rose-200',
  'Paid Return': 'bg-purple-50 text-purple-700 border-purple-200',
  'Returned To Inventory': 'bg-green-100 text-green-800 border-green-300',
  'Return In Transit': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'Return At Sorting': 'bg-stone-50 text-stone-700 border-stone-200',
  'Return At Sorting Hub': 'bg-stone-50 text-stone-700 border-stone-200',
  'Assigned for return': 'bg-rose-100 text-rose-800 border-rose-300',
  'First Mile Hub': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Return To Merchant': 'bg-orange-50 text-orange-700 border-orange-200',
  'At Inventory': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-50 text-slate-700 border-slate-200',
  'Pickup Failed': 'bg-red-50 text-red-700 border-red-200',
  'Return pending': 'bg-zinc-50 text-zinc-700 border-zinc-200',
  'Waiting for Pickup': 'bg-lime-50 text-lime-700 border-lime-200',
  'On the Way To Delivery Hub': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Lost': 'bg-red-50 text-red-700 border-red-200',
};

export const CALL_STATUS_COLORS: Record<CallStatus, string> = {
  Picked: 'bg-green-100 text-green-700 border-green-200',
  'Not Picked': 'bg-red-100 text-red-700 border-red-200',
  Busy: 'bg-amber-100 text-amber-700 border-amber-200',
  'Switched Off': 'bg-gray-100 text-gray-700 border-gray-200',
  Rescheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  'Wrong Number': 'bg-rose-100 text-rose-700 border-rose-200',
  Waiting: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const ALL_CALL_STATUSES: CallStatus[] = [
  'Picked',
  'Waiting',
  'Busy',
  'Rescheduled',
  'Not Picked',
  'Switched Off',
  'Wrong Number'
];

export const LOCKED_STATUSES: Status[] = [
  'Return',
  'Exchange',
  'Delivered',
  'Paid Return',
  'Pickup Failed',
  'Return pending',
  'Partial Delivery',
  'Return In Transit',
  'Return To Merchant',
  'Return At Sorting Hub',
  'Returned To Inventory',
  'At Inventory',
  'Lost'
];

export type OrderStatus = 
  | 'Pending' 
  | 'RTS' 
  | 'Shipped' 
  | 'Delivered' 
  | 'Pending Return' 
  | 'Returned' 
  | 'Return' 
  | 'Paid Return' 
  | 'Partial' 
  | 'Partial Delivery' 
  | 'Cancelled' 
  | 'Pending Cancel' 
  | 'Preorder' 
  | 'In Review' 
  | 'Exchange' 
  | 'Lost'
  | string;

export interface OrderItem {
  name: string;
  qty: number;
  sku?: string;
  code?: string;
  purchasePrice?: number;
  salePrice?: number;
  price?: number;
  image?: string;
}

export interface Order {
  id: string;
  userId: string;
  invoice: string; // e.g. "AR-23804"
  customer?: string;
  customerName?: string;
  phone: string;
  phoneSuccessRate?: number; // e.g. 74, 100
  address?: string;
  city?: string;
  zone?: string;
  note?: string;
  shippingNote?: string;
  items: OrderItem[];
  productName?: string;
  code?: string;
  sku?: string;
  qty?: number;
  tags?: string[]; // e.g. ['REPEAT', 'VIP']
  customTags?: string[];
  statusTags?: string[]; // e.g. ['Employee Discount Order', 'Repeat Customer']
  printStatus?: boolean;
  total: number;
  codAmount?: number;
  delivery?: number;
  deliveryCharge?: number;
  discount?: number;
  advance?: number;
  status: OrderStatus;
  courier?: string; // 'Pathao' | 'Steadfast' | 'RedX' | etc.
  uploadStatus?: string;
  isCrossSale?: boolean;
  user?: string; // e.g. "Masuma Aktar"
  source?: string; // "Website" | "WooCommerce" | "Shopify" | "Facebook" | "Manual"
  webOrderId?: string;
  sourceOrderId?: string;
  date?: string;
  created_at?: string;
  courier_date?: string;
  createdAt: any;
  updatedAt: any;
  syncedAt?: any;
}

export interface Product {
  id: string;
  userId: string;
  code: string;
  name: string;
  purchasePrice: number;
  saleAmount: number;
  image?: string;
  createdAt: any;
  updatedAt: any;
}

export interface CourierData {
  id: string;
  userId: string;
  merchantOrderId: string;
  collectedAmount: number;
  totalFee: number;
  status: Status;
  courierDate?: string;
  updatedAt: any;
}

export type ExpenseGroup = 'Daily' | 'Dollar' | 'Monthly';
export type ExpenseCategory = 'Office' | 'Ads' | 'Others';

export interface Expense {
  id: string;
  userId: string;
  description: string;
  amount: number; // This will be the BDT amount
  usdAmount?: number; // For Dollar expenses
  dollarRate?: number; // For Dollar expenses
  group: ExpenseGroup;
  category?: ExpenseCategory;
  date: string;
  createdAt: any;
  updatedAt: any;
}

export interface AppSettings {
  id: string;
  userId: string;
  dollarRate: number;
  updatedAt: any;
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Delivered: 'bg-green-100 text-green-700 border-green-200',
  Returned: 'bg-red-100 text-red-700 border-red-200',
  Return: 'bg-rose-100 text-rose-700 border-rose-200',
  'Paid Return': 'bg-purple-100 text-purple-700 border-purple-200',
  'In Review': 'bg-blue-100 text-blue-700 border-blue-200',
  Exchange: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Partial Delivery': 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

export interface StatusLog {
  id: string;
  userId: string;
  orderId: string;
  consignmentId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}

// WooCommerce Integration Types
export type CustomOrderStatus = 
  | 'Processing'
  | 'Incomplete'
  | 'Good But No Response'
  | 'No Response'
  | 'Advance Payment'
  | 'On Hold'
  | 'Approved'
  | 'Cancel';

export const CUSTOM_ORDER_STATUSES: CustomOrderStatus[] = [
  'Processing',
  'Incomplete',
  'Good But No Response',
  'No Response',
  'Advance Payment',
  'On Hold',
  'Approved',
  'Cancel'
];

export const CUSTOM_ORDER_STATUS_META: Record<CustomOrderStatus, { bg: string; text: string; border: string; label: string }> = {
  'Processing': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/80',
    label: 'Processing'
  },
  'Incomplete': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    label: 'Incomplete'
  },
  'Good But No Response': {
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200/80',
    label: 'Good But No Response'
  },
  'No Response': {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200/80',
    label: 'No Response'
  },
  'Advance Payment': {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200/80',
    label: 'Advance Payment'
  },
  'On Hold': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-200/80',
    label: 'On Hold'
  },
  'Approved': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200/80',
    label: 'Approved'
  },
  'Cancel': {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200/80',
    label: 'Cancel'
  }
};

export type WooOrderStatus = 
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'trash'
  | string;

export interface WooOrderItem {
  id: number | string;
  name: string;
  productId: number;
  variationId?: number;
  quantity: number;
  subtotal: number | string;
  total: number | string;
  sku?: string;
  price: number;
  image?: string;
}

export interface WooSite {
  id: string;
  userId: string;
  name: string;
  storeUrl: string;
  consumerKey: string;
  consumerSecretMasked?: string;
  hasSecret?: boolean;
  webhookSecret?: string;
  webhookId?: number | string;
  webhookStatus?: 'active' | 'inactive' | 'paused';
  webhookDeliveryUrl?: string;
  status: 'Connected' | 'Disconnected' | 'Error';
  lastSyncAt?: string;
  autoSyncInterval?: 'off' | '5m' | '15m' | '30m' | '1h';
  currency?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifySite {
  id: string;
  userId: string;
  name: string;
  shopDomain: string; // e.g. "my-brand.myshopify.com" or "mybrand.com"
  storeUrl?: string;
  accessToken: string;
  accessTokenMasked?: string;
  apiKey?: string;
  apiSecret?: string;
  apiSecretMasked?: string;
  webhookSecret?: string;
  webhookId?: number | string;
  webhookStatus?: 'active' | 'inactive' | 'paused';
  webhookDeliveryUrl?: string;
  status: 'Connected' | 'Disconnected' | 'Error';
  lastSyncAt?: string;
  currency?: string;
  currencyCode?: string;
  errorMessage?: string;
  totalOrdersCount?: number;
  lastWebhookReceivedAt?: string;
  lastOrderReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  topic: string;
  deliveryId?: string;
  wooOrderId?: number | string;
  shopifyOrderId?: number | string;
  orderNumber?: string;
  siteId?: string;
  siteName?: string;
  source?: 'woocommerce' | 'shopify' | string;
  status: 'success' | 'failed' | 'ignored';
  httpStatus: number;
  processingTimeMs: number;
  customerName?: string;
  total?: number;
  currency?: string;
  sourceUrl?: string;
  sourceDomain?: string;
  sourceIp?: string;
  errorMessage?: string;
  signatureVerified: boolean;
  rawPayloadSnippet?: string;
}

export interface ShopifyWebhookEvent {
  id: string;
  userId: string;
  storeId: string;
  storeName?: string;
  webhookId: string;
  topic: string;
  receivedAt: string;
  processedAt?: string;
  status: 'received' | 'processing' | 'processed' | 'duplicate' | 'failed';
  shopifyOrderId?: string | number;
  errorMessage?: string;
}

export interface WebOrder {
  id: string; // "woo_${siteId}_${wooOrderId}" or "shopify_${siteId}_${shopifyOrderId}"
  userId: string;
  source?: 'woocommerce' | 'shopify' | string;
  external_platform?: 'woocommerce' | 'shopify' | string;
  storeId?: string;
  store_id?: string;
  store_name?: string;
  sourceStoreId?: string;
  wooOrderId?: number | string;
  wooSiteId?: string;
  wooSiteName?: string;
  shopifyOrderId?: number | string;
  shopifyOrderName?: string;
  orderNumber: string;
  orderDate: string;
  status: WooOrderStatus | string; // Legacy / WooCommerce / Shopify status
  woocommerce_status?: string; // Stored separately for WooCommerce sync
  shopify_status?: string; // Shopify financial/fulfillment status
  custom_status: CustomOrderStatus | string; // Separate custom status
  customStatus?: CustomOrderStatus | string;
  currency: string;
  total: number;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  paymentMethod: string;
  paymentMethodTitle: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  billingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email?: string;
    phone?: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone?: string;
  };
  items: WooOrderItem[];
  itemCount: number;
  customerNote?: string;
  shippingMethodTitle?: string;
  deliveryMethod?: string;
  adminNote?: string;
  approvedAt?: string;
  viewOrderUrl?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export const WOO_STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  processing: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/80',
    label: 'Processing'
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    label: 'Completed'
  },
  'on-hold': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/80',
    label: 'On Hold'
  },
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200/80',
    label: 'Pending payment'
  },
  cancelled: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/80',
    label: 'Cancelled'
  },
  refunded: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200/80',
    label: 'Refunded'
  },
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200/80',
    label: 'Failed'
  },
  trash: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200/80',
    label: 'Trash'
  }
};

