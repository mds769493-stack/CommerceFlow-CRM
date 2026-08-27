import React from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { WebOrdersPage } from '../components/woocommerce/WebOrdersPage';
import { WebOrderDetailPage } from './WebOrderDetailPage';

const KNOWN_STATUS_KEYS = new Set([
  'processing',
  'incomplete',
  'good but no response',
  'good-but-no-response',
  'no response',
  'no-response',
  'advance payment',
  'advance-payment',
  'on hold',
  'on-hold',
  'approved',
  'cancel',
  'all',
  'list',
  'new',
  'auto-pick',
  'auto-call',
  'block-list'
]);

export function WebOrdersPageWrapper() {
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  
  const path = location.pathname.toLowerCase();
  
  // If the route parameter matches a numeric order ID or order prefix, render WebOrderDetailPage
  if (params.status && (!KNOWN_STATUS_KEYS.has(params.status.toLowerCase()) || /^\d+$/.test(params.status) || params.status.startsWith('woo_') || params.status.startsWith('shopify_'))) {
    return <WebOrderDetailPage />;
  }

  let initialTab: string | undefined = undefined;
  if (params.status) {
    initialTab = params.status;
  } else if (searchParams.get('status')) {
    initialTab = searchParams.get('status') || undefined;
  } else if (path.includes('approved') || path === '/approved-orders') {
    initialTab = 'Approved';
  } else if (path.includes('processing')) {
    initialTab = 'Processing';
  } else if (path.includes('on-hold')) {
    initialTab = 'On Hold';
  } else if (path.includes('cancel')) {
    initialTab = 'Cancel';
  }

  const isNewOrderPath = path === '/web-orders/new';

  return (
    <WebOrdersPage 
      initialStatus={initialTab} 
      autoOpenManualSync={isNewOrderPath}
    />
  );
}
export default WebOrdersPageWrapper;

