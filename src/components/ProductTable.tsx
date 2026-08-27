import React, { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pagination } from './Pagination';
// Skeleton removed
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Product } from '../types';
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Search, Trash2, Package, TrendingUp, TrendingDown, Edit3, Check, X, Copy, Sparkles, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BulkEditProductsDialog } from './BulkEditProductsDialog';
import { ImageLightbox } from './ImageLightbox';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface ProductTableProps {
  products: Product[];
  onUpdate: (id: string, updates: Partial<Product>) => void;
  onUpdateMultiple: (updatesList: { id: string; updates: Partial<Product> }[]) => Promise<void>;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onDuplicate?: (product: Product) => void;
  onExport?: () => void;
  
  // Pagination & Server-side props
  currentPage: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  isFetching: boolean;
}

export function ProductTable({ 
  products, 
  onUpdate, 
  onUpdateMultiple,
  onDelete, 
  onDeleteMultiple,
  onDuplicate,
  onExport,
  currentPage,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  search: externalSearch,
  onSearchChange,
  isFetching
}: ProductTableProps) {
  const [localSearch, setLocalSearch] = useState(externalSearch);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Product>>({});
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ isOpen: boolean; url: string; name: string }>({
    isOpen: false,
    url: '',
    name: ''
  });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil(totalRecords / pageSize);

  const rowVirtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    onSearchChange(val);
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditValues({
      code: product.code,
      name: product.name,
      purchasePrice: product.purchasePrice,
      saleAmount: product.saleAmount,
      image: product.image || ''
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEditing = () => {
    if (editingId) {
      onUpdate(editingId, editValues);
      setEditingId(null);
      setEditValues({});
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length && products.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    onDeleteMultiple(selectedIds);
    setSelectedIds([]);
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // Fallback: Export current page if no global export provided
      const dataToExport = products.map(p => ({
        Code: p.code,
        Name: p.name,
        'Cost Price': p.purchasePrice,
        'Sale Price': p.saleAmount,
        Image: p.image || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      XLSX.writeFile(wb, `Products_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search code or product name..." 
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 rounded-xl px-3 gap-1.5 border-slate-300 hover:border-slate-900 bg-white hover:bg-slate-50 font-bold text-slate-800 text-xs shadow-2xs transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-700" />
            Export Data
          </Button>

          {selectedIds.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkEditOpen(true)}
                className="h-10 rounded-xl px-4 gap-2 border-slate-200 bg-white hover:bg-slate-50 font-bold text-indigo-700 shadow-sm transition-all hover:border-indigo-200"
              >
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Bulk Edit ({selectedIds.length})
              </Button>

              <AlertDialog>
                <AlertDialogTrigger nativeButton={true} render={
                  <button className={cn(buttonVariants({ variant: "destructive", size: "sm", className: "h-10 rounded-xl px-4 gap-2 shadow-lg shadow-rose-100 font-bold" }))}>
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedIds.length})
                  </button>
                } />
                <AlertDialogContent className="bg-white rounded-[2.5rem] border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden outline-none fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Selected Products?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove {selectedIds.length} products permanently.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel variant="outline" size="default" className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div ref={scrollContainerRef} className="custom-scrollbar scroll-smooth overflow-x-auto overflow-y-auto relative max-h-[600px] bg-slate-50/30">
          <Table className="table-fixed border-separate border-spacing-0 w-full">
            <TableHeader className="sticky top-0 z-30 bg-white">
              <TableRow className="hover:bg-transparent border-b border-slate-100 flex w-full min-w-[900px]">
                <TableHead className="w-12 min-w-[48px] max-w-[48px] px-2 h-10 text-center sticky left-0 z-40 bg-white flex items-center justify-center border-r border-slate-100">
                  <Checkbox 
                    checked={products.length > 0 && selectedIds.length === products.length}
                    onCheckedChange={toggleSelectAll}
                    className="border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                </TableHead>
                <TableHead className="w-[140px] min-w-[140px] max-w-[140px] font-black text-slate-500 text-[10px] uppercase tracking-wider px-3 h-10 flex items-center border-r border-slate-50">Code</TableHead>
                <TableHead className="flex-1 min-w-[300px] font-black text-slate-500 text-[10px] uppercase tracking-wider px-4 h-10 flex items-center border-r border-slate-50">Product Name & Image</TableHead>
                <TableHead className="w-[150px] min-w-[150px] max-w-[150px] font-black text-slate-500 text-[10px] uppercase tracking-wider px-4 h-10 flex items-center justify-end border-r border-slate-50">Cost Price</TableHead>
                <TableHead className="w-[150px] min-w-[150px] max-w-[150px] font-black text-slate-500 text-[10px] uppercase tracking-wider px-4 h-10 flex items-center justify-end border-r border-slate-50">Sale Price</TableHead>
                <TableHead className="w-[100px] min-w-[100px] max-w-[100px] font-black text-slate-500 text-[10px] uppercase tracking-wider px-4 h-10 flex items-center justify-end sticky right-0 z-40 bg-white shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-100">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody style={{ height: products.length === 0 ? "256px" : `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {products.length === 0 ? (
                <TableRow className="w-full flex justify-center absolute left-0 right-0 h-64 border-0">
                  <TableCell className="w-full h-full flex flex-col items-center justify-center border-0 bg-white">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Package className="h-8 w-8 opacity-20" />
                      <p className="font-medium">No products found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const product = products[virtualRow.index];
                  if (!product) return null;
                  const isEditing = editingId === product.id;

                  return (
                    <TableRow 
                      key={virtualRow.key} 
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={cn(
                        "group transition-colors absolute w-full min-w-[900px] flex bg-white",
                        isEditing ? "bg-indigo-50/50" : (selectedIds.includes(product.id) ? "bg-blue-50/30" : "hover:bg-slate-50/50")
                      )}
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TableCell className="w-12 min-w-[48px] max-w-[48px] px-2 py-3 text-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-slate-100 flex items-center justify-center">
                        {!isEditing && (
                          <Checkbox 
                            checked={selectedIds.includes(product.id)}
                            onCheckedChange={() => toggleSelect(product.id)}
                            className="border-slate-200 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        )}
                      </TableCell>
                      <TableCell className="w-[140px] min-w-[140px] max-w-[140px] px-3 py-3 border-r border-slate-50 flex items-center">
                        {isEditing ? (
                          <Input 
                            value={editValues.code || ''}
                            onChange={(e) => setEditValues({ ...editValues, code: e.target.value })}
                            className="h-8 text-[11px] font-mono font-bold w-full bg-white transition-all focus:ring-2 focus:ring-indigo-100 uppercase"
                          />
                        ) : (
                          <span className="font-mono text-xs font-bold text-slate-700 tracking-tight uppercase truncate">{product.code}</span>
                        )}
                      </TableCell>
                      <TableCell className="flex-1 min-w-[300px] px-4 py-3 border-r border-slate-50 flex items-center">
                        {isEditing ? (
                          <div className="flex flex-col gap-1 w-full py-1">
                            <Input 
                              value={editValues.name || ''}
                              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                              className="h-8 text-xs font-semibold w-full bg-white transition-all focus:ring-2 focus:ring-indigo-100"
                              placeholder="Name"
                            />
                            <Input 
                              value={editValues.image || ''}
                              onChange={(e) => setEditValues({ ...editValues, image: e.target.value })}
                              className="h-6 text-[10px] w-full bg-white transition-all focus:ring-2 focus:ring-indigo-100"
                              placeholder="Image URL"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              className="relative cursor-zoom-in shrink-0 group/img-preview"
                              onClick={() => product.image && setLightbox({ isOpen: true, url: product.image, name: product.name })}
                            >
                              {product.image ? (
                                <>
                                  <img 
                                    src={product.image} 
                                    alt={product.name}
                                    className="h-10 w-10 rounded-lg border border-slate-200/60 object-cover bg-slate-50 transition-all group-hover/img-preview:border-blue-400 group-hover/img-preview:shadow-md"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                      const placeholder = (e.target as HTMLElement).nextElementSibling;
                                      if (placeholder) {
                                        placeholder.classList.remove('hidden');
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover/img-preview:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                                    <Search className="h-3 w-3 text-white opacity-0 group-hover/img-preview:opacity-100 transition-opacity" />
                                  </div>
                                </>
                              ) : null}
                              <div className={cn(
                                "h-10 w-10 rounded-lg border border-slate-200/60 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-all group-hover/img-preview:border-blue-400 group-hover/img-preview:shadow-md",
                                product.image ? "hidden" : ""
                              )}>
                                <Package className="h-5 w-5" />
                              </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-800 text-xs truncate leading-tight mb-0.5">{product.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Shopify Mapped</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-blue-600 rounded-md shrink-0 ml-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(product.name);
                              }}
                              title="Copy product name"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-[150px] min-w-[150px] max-w-[150px] px-4 py-3 text-right flex items-center justify-end border-r border-slate-50">
                        {isEditing ? (
                          <Input 
                            type="number"
                            value={editValues.purchasePrice || 0}
                            onChange={(e) => setEditValues({ ...editValues, purchasePrice: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-24 text-right bg-white transition-all focus:ring-2 focus:ring-indigo-100 text-xs tabular-nums"
                          />
                        ) : (
                          <span className="font-semibold text-slate-600 tabular-nums text-xs">৳{(product.purchasePrice || 0).toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="w-[150px] min-w-[150px] max-w-[150px] px-4 py-3 text-right flex items-center justify-end border-r border-slate-50">
                        {isEditing ? (
                          <Input 
                            type="number"
                            value={editValues.saleAmount || 0}
                            onChange={(e) => setEditValues({ ...editValues, saleAmount: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-24 text-right bg-white transition-all focus:ring-2 focus:ring-indigo-100 font-bold text-xs tabular-nums text-blue-600"
                          />
                        ) : (
                          <span className="font-bold text-slate-900 tabular-nums text-sm">৳{(product.saleAmount || 0).toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="w-[100px] min-w-[100px] max-w-[100px] px-4 py-3 text-right sticky right-0 z-10 bg-white group-hover:bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-100 flex items-center justify-end">
                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveEditing}
                                className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 rounded-lg shadow-sm border border-emerald-100 animate-in fade-in"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditing}
                                className="h-7 w-7 p-0 text-slate-400 hover:bg-slate-100 rounded-lg"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(product)}
                                className="h-8 w-8 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger nativeButton={true} render={
                                  <button className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors shadow-sm border border-rose-100">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                } />
                                <AlertDialogContent className="bg-white rounded-[2.5rem] border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden outline-none fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] max-w-md">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl font-bold">Delete Product?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-500">
                                      Permanently remove <span className="font-bold text-slate-900">{product.name}</span>.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="rounded-xl h-9 text-xs">Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => onDelete(product.id)}
                                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold h-9 text-xs"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              {onDuplicate && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onDuplicate(product)}
                                  className="h-8 w-8 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Duplicate product"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          
          {isFetching && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Fetching Products...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <BulkEditProductsDialog
        products={products.filter(p => selectedIds.includes(p.id))}
        isOpen={isBulkEditOpen}
        onOpenChange={setIsBulkEditOpen}
        onSave={async (updates) => {
          await onUpdateMultiple(updates);
          setSelectedIds([]);
        }}
      />

      <ImageLightbox
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
        imageUrl={lightbox.url}
        productName={lightbox.name}
      />
    </div>
  );
}
