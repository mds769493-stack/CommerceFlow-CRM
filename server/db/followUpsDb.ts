import { readJsonCollectionFile, writeJsonCollectionFile } from './fileStorage.ts';

export interface FollowUpHistoryItem {
  date: string;
  note: string;
  status?: string;
  author?: string;
  [key: string]: any;
}

export interface FollowUpRecord {
  id: string;
  userId: string;
  invoice?: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  status: string;
  category?: string;
  productName?: string;
  sku?: string;
  amount?: number;
  note?: string;
  nextFollowUpDate?: string;
  history?: FollowUpHistoryItem[];
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

const FOLLOWUPS_COLLECTION = 'followUps';
const STATUS_LOGS_COLLECTION = 'statusLogs';

/**
 * Get all Follow-ups
 */
export async function getFollowUps(userId: string): Promise<FollowUpRecord[]> {
  return await readJsonCollectionFile(userId, FOLLOWUPS_COLLECTION);
}

/**
 * Get single Follow-up by ID
 */
export async function getFollowUpById(userId: string, id: string): Promise<FollowUpRecord | null> {
  const items = await getFollowUps(userId);
  return items.find(f => f.id === id || f.invoice === id) || null;
}

/**
 * Save or update a single Follow-up
 */
export async function saveFollowUp(userId: string, item: Partial<FollowUpRecord> & { id?: string }): Promise<FollowUpRecord> {
  const items = await getFollowUps(userId);
  const now = new Date().toISOString();
  const id = item.id || `flw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const existingIndex = items.findIndex(f => f.id === id);
  let finalRecord: FollowUpRecord;

  if (existingIndex >= 0) {
    finalRecord = {
      ...items[existingIndex],
      ...item,
      id: items[existingIndex].id,
      updatedAt: now
    };
    items[existingIndex] = finalRecord;
  } else {
    finalRecord = {
      id,
      userId,
      customerName: item.customerName || 'Customer',
      customerPhone: item.customerPhone || '',
      status: item.status || 'Pending',
      createdAt: item.createdAt || now,
      updatedAt: now,
      ...item
    } as FollowUpRecord;
    items.unshift(finalRecord);
  }

  await writeJsonCollectionFile(userId, FOLLOWUPS_COLLECTION, items);
  return finalRecord;
}

/**
 * Batch save Follow-ups
 */
export async function batchSaveFollowUps(userId: string, items: FollowUpRecord[], strategy: string = 'keep'): Promise<void> {
  const existing = await getFollowUps(userId);
  const now = new Date().toISOString();

  if (strategy === 'replace') {
    const formatted = items.map(it => ({
      ...it,
      id: it.id || `flw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      updatedAt: now
    }));
    await writeJsonCollectionFile(userId, FOLLOWUPS_COLLECTION, formatted);
    return;
  }

  for (const item of items) {
    const id = item.id || `flw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idx = existing.findIndex(f => f.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...item, updatedAt: now };
    } else {
      existing.unshift({ ...item, id, userId, updatedAt: now });
    }
  }

  await writeJsonCollectionFile(userId, FOLLOWUPS_COLLECTION, existing);
}

/**
 * Delete a single Follow-up
 */
export async function deleteFollowUp(userId: string, id: string): Promise<boolean> {
  const items = await getFollowUps(userId);
  const filtered = items.filter(f => f.id !== id);
  if (filtered.length !== items.length) {
    await writeJsonCollectionFile(userId, FOLLOWUPS_COLLECTION, filtered);
    return true;
  }
  return false;
}

/**
 * Get Status Logs
 */
export async function getStatusLogs(userId: string): Promise<any[]> {
  return await readJsonCollectionFile(userId, STATUS_LOGS_COLLECTION);
}

/**
 * Save Status Log
 */
export async function saveStatusLog(userId: string, log: any): Promise<void> {
  const logs = await getStatusLogs(userId);
  logs.unshift({
    id: log.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    timestamp: log.timestamp || new Date().toISOString(),
    ...log
  });
  await writeJsonCollectionFile(userId, STATUS_LOGS_COLLECTION, logs);
}
