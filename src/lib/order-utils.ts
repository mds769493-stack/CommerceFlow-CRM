import { Order, OrderStatus, CourierData, Product } from '../types';

export const getMappedStatus = (courierStatus: string | undefined): OrderStatus | '' => {
  if (!courierStatus) return "";
  const s = courierStatus.trim();
  const pendingStatuses = [
    "At Sorting Hub",
    "Received at Last Mile HUB",
    "At Delivery Hub",
    "In Transit",
    "On the Way To Delivery Hub",
    "Assigned For Delivery",
    "On Hold",
    "Reattempt Requested",
    "Return Requested",
    "On the Way to Last Mile HUB"
  ];
  
  if (pendingStatuses.includes(s)) return "Pending";
  if (s === "Delivered") return "Delivered";
  
  const returnStatuses = ["Return In Transit", "Return On Hold", "Return", "Returned"];
  if (returnStatuses.includes(s)) return "Returned";
  
  if (s === "Paid Return") return "Paid Return";
  
  const reviewStatuses = ["Waiting for Pickup", "Pickup Cancel"];
  if (reviewStatuses.includes(s)) return "In Review";
  
  if (s === "Exchange") return "Exchange";
  if (s === "Partial Delivery") return "Partial Delivery";
  
  return "";
};

export const getDisplayStatus = (order: Order, courierMap: Map<string, CourierData>): string => {
  const invoice = (order.invoice || "").toLowerCase().trim();
  const matched = invoice ? courierMap.get(invoice) : undefined;
  const internalStatus = (order.status || "Pending");
  const courierStatusRaw = matched?.status || "";
  const mappedStatus = matched ? getMappedStatus(matched.status) : "";
  
  return mappedStatus || courierStatusRaw || internalStatus;
};

export const getOrderWarningType = (
  order: Order, 
  products: Product[] = [], 
  courierMap?: Map<string, CourierData>
): string | null => {
  const ordAny = order as any;
  if (ordAny.warningType) return ordAny.warningType;
  if (ordAny.warning) return ordAny.warning;

  const displayStatus = courierMap ? getDisplayStatus(order, courierMap) : (order.status || '');
  const sVal = (displayStatus || "").toLowerCase();
  const isSpecialStatus = sVal === 'paid return' || sVal === 'return' || sVal === 'pending';
  
  const itemSalesTotal = order.items?.reduce((sum, item) => {
    const itemName = (item.name || "").toLowerCase().trim();
    const product = products.find(p => {
      const pName = (p.name || "").toLowerCase().trim();
      const pCode = (p.code || "").toLowerCase().trim();
      return pName === itemName || pCode === itemName;
    });
    const price = item.salePrice ?? product?.saleAmount ?? 0;
    return sum + (price * item.qty);
  }, 0) || 0;

  const effectiveTotal = itemSalesTotal + (order.delivery || 0);
  const E = order.codAmount || 0;
  const K = order.advance || 0;
  const U = isSpecialStatus ? 0 : (effectiveTotal - E - K);

  if (order.advance && order.advance > 0) {
    return 'Advance';
  }
  
  if (Math.abs(U) <= 0.01) {
    const hasMissingPrices = order.items?.some(item => {
      const itemName = (item.name || "").toLowerCase().trim();
      const matchedProd = products.find(p => 
        (p.name || "").toLowerCase().trim() === itemName || 
        (p.code || "").toLowerCase().trim() === itemName
      );
      const isCostMissing = item.purchasePrice === undefined ? (!matchedProd || matchedProd.purchasePrice === undefined || matchedProd.purchasePrice <= 0) : false;
      const isPriceMissing = item.salePrice === undefined ? (!matchedProd || matchedProd.saleAmount === undefined || matchedProd.saleAmount <= 0) : false;
      return isCostMissing || isPriceMissing;
    });
    if (hasMissingPrices) return 'Price Required';
    if (ordAny.has_warning === true || ordAny.hasWarning === true) return 'Warning';
    return null;
  }
  
  if (U > 0) return 'Discount';
  if (U < 0 && U >= -150) return 'Over Charges';
  if (U < -150) return 'Update Qty';

  if (ordAny.has_warning === true || ordAny.hasWarning === true) return 'Warning';
  
  return null;
};

