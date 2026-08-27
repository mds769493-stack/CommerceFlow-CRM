import { readJsonCollectionFile, writeJsonCollectionFile } from './fileStorage.ts';

export interface ExpenseRecord {
  id: string;
  userId: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  group: 'Daily' | 'Monthly' | 'Yearly' | string;
  paymentMethod?: string;
  receiptImage?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

const EXPENSES_COLLECTION = 'expenses';
const SETTINGS_COLLECTION = 'settings';

/**
 * Get all Expenses
 */
export async function getExpenses(userId: string): Promise<ExpenseRecord[]> {
  return await readJsonCollectionFile(userId, EXPENSES_COLLECTION);
}

/**
 * Get single Expense by ID
 */
export async function getExpenseById(userId: string, id: string): Promise<ExpenseRecord | null> {
  const items = await getExpenses(userId);
  return items.find(e => e.id === id) || null;
}

/**
 * Save or update a single Expense
 */
export async function saveExpense(userId: string, item: Partial<ExpenseRecord> & { id?: string }): Promise<ExpenseRecord> {
  const items = await getExpenses(userId);
  const now = new Date().toISOString();
  const id = item.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const existingIndex = items.findIndex(e => e.id === id);
  let finalRecord: ExpenseRecord;

  if (existingIndex >= 0) {
    finalRecord = {
      ...items[existingIndex],
      ...item,
      amount: Number(item.amount !== undefined ? item.amount : items[existingIndex].amount),
      id: items[existingIndex].id,
      updatedAt: now
    };
    items[existingIndex] = finalRecord;
  } else {
    finalRecord = {
      id,
      userId,
      category: item.category || 'General',
      description: item.description || 'Expense entry',
      amount: Number(item.amount || 0),
      date: item.date || now.split('T')[0],
      group: item.group || 'Daily',
      paymentMethod: item.paymentMethod || 'Cash',
      createdAt: item.createdAt || now,
      updatedAt: now,
      ...item
    } as ExpenseRecord;
    items.unshift(finalRecord);
  }

  await writeJsonCollectionFile(userId, EXPENSES_COLLECTION, items);
  return finalRecord;
}

/**
 * Batch save Expenses
 */
export async function batchSaveExpenses(userId: string, items: ExpenseRecord[], strategy: string = 'keep'): Promise<void> {
  const existing = await getExpenses(userId);
  const now = new Date().toISOString();

  if (strategy === 'replace') {
    const formatted = items.map(it => ({
      ...it,
      id: it.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      updatedAt: now
    }));
    await writeJsonCollectionFile(userId, EXPENSES_COLLECTION, formatted);
    return;
  }

  for (const item of items) {
    const id = item.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idx = existing.findIndex(e => e.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...item, updatedAt: now };
    } else {
      existing.unshift({ ...item, id, userId, updatedAt: now });
    }
  }

  await writeJsonCollectionFile(userId, EXPENSES_COLLECTION, existing);
}

/**
 * Delete a single Expense
 */
export async function deleteExpense(userId: string, id: string): Promise<boolean> {
  const items = await getExpenses(userId);
  const filtered = items.filter(e => e.id !== id);
  if (filtered.length !== items.length) {
    await writeJsonCollectionFile(userId, EXPENSES_COLLECTION, filtered);
    return true;
  }
  return false;
}

/**
 * Batch delete Expenses
 */
export async function batchDeleteExpenses(userId: string, ids: string[]): Promise<void> {
  const items = await getExpenses(userId);
  const filtered = items.filter(e => !ids.includes(e.id));
  await writeJsonCollectionFile(userId, EXPENSES_COLLECTION, filtered);
}

/**
 * Expense Settings (Categories, etc.)
 */
export async function getExpenseSettings(userId: string): Promise<any[]> {
  return await readJsonCollectionFile(userId, SETTINGS_COLLECTION);
}

export async function saveExpenseSettings(userId: string, setting: any): Promise<void> {
  const settings = await getExpenseSettings(userId);
  const id = setting.id || 'default_expense_settings';
  const idx = settings.findIndex(s => s.id === id);
  if (idx >= 0) {
    settings[idx] = { ...settings[idx], ...setting, updatedAt: new Date().toISOString() };
  } else {
    settings.push({ ...setting, id, updatedAt: new Date().toISOString() });
  }
  await writeJsonCollectionFile(userId, SETTINGS_COLLECTION, settings);
}
