import { readJsonCollectionFile, writeJsonCollectionFile } from './fileStorage.ts';

export interface ProductRecord {
  id: string;
  userId: string;
  name: string;
  sku: string;
  category?: string;
  regularPrice: number;
  salePrice: number;
  stock: number;
  status: 'In Stock' | 'Stock Out' | 'Low Stock' | string;
  image?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

const PRODUCTS_COLLECTION = 'products';

/**
 * Get all Products
 */
export async function getProducts(userId: string): Promise<ProductRecord[]> {
  return await readJsonCollectionFile(userId, PRODUCTS_COLLECTION);
}

/**
 * Get single Product by ID or SKU
 */
export async function getProductById(userId: string, idOrSku: string): Promise<ProductRecord | null> {
  const products = await getProducts(userId);
  const clean = String(idOrSku).trim().toLowerCase();
  return products.find(p => 
    p.id.toLowerCase() === clean || 
    String(p.sku || '').toLowerCase() === clean
  ) || null;
}

/**
 * Save or update a single Product
 */
export async function saveProduct(userId: string, product: Partial<ProductRecord> & { id?: string }): Promise<ProductRecord> {
  const products = await getProducts(userId);
  const now = new Date().toISOString();
  const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const existingIndex = products.findIndex(p => p.id === id || (product.sku && p.sku && p.sku.toLowerCase() === product.sku.toLowerCase()));
  let finalRecord: ProductRecord;

  const stock = Number(product.stock !== undefined ? product.stock : 0);
  const status = product.status || (stock > 5 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Stock Out');

  if (existingIndex >= 0) {
    finalRecord = {
      ...products[existingIndex],
      ...product,
      stock,
      status,
      updatedAt: now
    };
    products[existingIndex] = finalRecord;
  } else {
    finalRecord = {
      id,
      userId,
      name: product.name || 'Untitled Product',
      sku: product.sku || `SKU-${Date.now().toString().slice(-4)}`,
      category: product.category || 'General',
      regularPrice: Number(product.regularPrice || 0),
      salePrice: Number(product.salePrice || product.regularPrice || 0),
      stock,
      status,
      image: product.image || '',
      description: product.description || '',
      createdAt: product.createdAt || now,
      updatedAt: now,
      ...product
    } as ProductRecord;
    products.unshift(finalRecord);
  }

  await writeJsonCollectionFile(userId, PRODUCTS_COLLECTION, products);
  return finalRecord;
}

/**
 * Batch save Products
 */
export async function batchSaveProducts(userId: string, items: ProductRecord[], strategy: string = 'keep'): Promise<void> {
  const existing = await getProducts(userId);
  const now = new Date().toISOString();

  if (strategy === 'replace') {
    const formatted = items.map(it => ({
      ...it,
      id: it.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      updatedAt: now
    }));
    await writeJsonCollectionFile(userId, PRODUCTS_COLLECTION, formatted);
    return;
  }

  for (const item of items) {
    const id = item.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idx = existing.findIndex(p => p.id === id || (item.sku && p.sku && p.sku.toLowerCase() === item.sku.toLowerCase()));
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...item, updatedAt: now };
    } else {
      existing.unshift({ ...item, id, userId, updatedAt: now });
    }
  }

  await writeJsonCollectionFile(userId, PRODUCTS_COLLECTION, existing);
}

/**
 * Delete a single Product
 */
export async function deleteProduct(userId: string, id: string): Promise<boolean> {
  const products = await getProducts(userId);
  const filtered = products.filter(p => p.id !== id);
  if (filtered.length !== products.length) {
    await writeJsonCollectionFile(userId, PRODUCTS_COLLECTION, filtered);
    return true;
  }
  return false;
}

/**
 * Batch delete Products
 */
export async function batchDeleteProducts(userId: string, ids: string[]): Promise<void> {
  const products = await getProducts(userId);
  const filtered = products.filter(p => !ids.includes(p.id));
  await writeJsonCollectionFile(userId, PRODUCTS_COLLECTION, filtered);
}
