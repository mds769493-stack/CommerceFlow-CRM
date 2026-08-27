import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ProductTable } from '../components/ProductTable';
import { AddProductDialog } from '../components/AddProductDialog';
import { ImportProductsDialog } from '../components/ImportProductsDialog';

export function ProductsPage() {
  const {
    products,
    totalProducts,
    isProductsFetching,
    productsPage,
    setProductsPage,
    productsPageSize,
    setProductsPageSize,
    productsSearch,
    setProductsSearch,
    addProduct,
    updateProduct,
    updateProducts,
    deleteProduct,
    deleteProducts,
    bulkImportProducts
  } = useAppContext();

  return (
    <div className="space-y-4">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Product Inventory
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              {totalProducts.toLocaleString()} Items
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">SKU codes, purchase prices, stock tracking, and supplier management</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ImportProductsDialog
            onImport={bulkImportProducts}
            existingProducts={products}
          />

          <AddProductDialog
            onAdd={addProduct}
          />
        </div>
      </div>

      <ProductTable
        products={products}
        onUpdate={updateProduct}
        onUpdateMultiple={updateProducts}
        onDelete={deleteProduct}
        onDeleteMultiple={deleteProducts}
        currentPage={productsPage}
        totalRecords={totalProducts}
        pageSize={productsPageSize}
        onPageChange={setProductsPage}
        onPageSizeChange={setProductsPageSize}
        search={productsSearch}
        onSearchChange={setProductsSearch}
        isFetching={isProductsFetching}
      />
    </div>
  );
}
export default ProductsPage;
