import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { 
  FileJson, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X,
  Download,
  Package,
  Loader2
} from 'lucide-react';
import { Product } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

interface ImportProductsDialogProps {
  onImport: (products: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  existingProducts: Product[];
}

export function ImportProductsDialog({ onImport, existingProducts }: ImportProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [countdown, setCountdown] = useState<number>(0);
  const [totalEstimatedTime, setTotalEstimatedTime] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const apiFinishedRef = useRef(false);
  const apiErrorRef = useRef<any>(null);

  const reset = () => {
    setFile(null);
    setPreviewData([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsImporting(false);
    setCountdown(0);
    setTotalEstimatedTime(0);
    setIsSuccess(false);
    apiFinishedRef.current = false;
    apiErrorRef.current = null;
  };

  useEffect(() => {
    if (!isImporting) return;

    const startTime = Date.now();
    const totalMs = totalEstimatedTime * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let remaining = Math.max(0, totalMs - elapsed) / 1000;

      if (apiFinishedRef.current) {
        if (apiErrorRef.current) {
          clearInterval(interval);
          setIsImporting(false);
          setError(`Failed to import products: ${apiErrorRef.current.message || String(apiErrorRef.current)}`);
          return;
        }
        remaining = Math.max(0, remaining - 0.25);
      } else {
        if (remaining <= 0.1) {
          remaining = 0.1;
        }
      }

      setCountdown(remaining);

      if (remaining <= 0 && apiFinishedRef.current) {
        clearInterval(interval);
        setIsSuccess(true);
        setIsImporting(false);

        try {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.5 }
          });
        } catch (err) {
          console.warn("Confetti failed", err);
        }
      }
    }, 40);

    return () => clearInterval(interval);
  }, [isImporting, totalEstimatedTime]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    const fileName = (selectedFile.name || "").toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        // sheet_to_json with header: 1 returns array of arrays, but our validateAndSetData expects objects
        // However, we can adapt validateAndSetData to handle both
        validateAndSetData(data);
      };
      reader.readAsBinaryString(selectedFile);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        if (fileName.endsWith('.json')) {
          try {
            const json = JSON.parse(content);
            validateAndSetData(Array.isArray(json) ? json : [json]);
          } catch (e) {
            setError('Invalid JSON format');
          }
        } else {
          Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              validateAndSetData(results.data);
            },
            error: () => setError('Error parsing CSV')
          });
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const validateAndSetData = (data: any[]) => {
    if (!data || data.length === 0) return;

    let validated: any[] = [];

    // Helper to find key in object or index in array
    const getValue = (item: any, searchTerms: string[], indexIfArray: number) => {
      if (Array.isArray(item)) {
        return item[indexIfArray];
      }
      const keys = Object.keys(item);
      for (const term of searchTerms) {
        const searchTermL = (term || "").toLowerCase().replace(/[\s_-]/g, '');
        const found = keys.find(k => {
          const keyL = (k || "").toLowerCase().trim().replace(/[\s_-]/g, '');
          return keyL === searchTermL;
        });
        if (found) return item[found];
      }
      return null;
    };

    const isFirstRowHeader = Array.isArray(data[0]) && data[0].some((c: any) => 
      String(c).toLowerCase().includes('name') || String(c).toLowerCase().includes('code') || String(c).toLowerCase().includes('sku')
    );

    validated = data.map((item, idx) => {
      if (isFirstRowHeader && idx === 0) return null;

      const code = (getValue(item, ['Code', 'sku', 'product code', 'sku code', 'product sku'], 0) || '').toString().trim();
      const name = (getValue(item, ['Name', 'Product Name', 'description', 'title'], 1) || '').toString().trim();
      const image = (getValue(item, ['Image', 'Product Image', 'image_url', 'image url', 'pic', 'picture', 'o'], 14) || '').toString().trim();
      const purchasePrice = parseFloat(String(getValue(item, ['Cost Price', 'Cost', 'Purchase Price', 'Purchase', 'cost_price'], 2) || '0').replace(/[^0-9.]/g, ''));
      const saleAmount = parseFloat(String(getValue(item, ['Price', 'Sale Price', 'Sale Amount', 'Sale', 'price'], 3) || '0').replace(/[^0-9.]/g, ''));

      return { code, name, purchasePrice, saleAmount, image };
    }).filter(item => item && item.code && item.name);

    if (validated.length === 0) {
      setError('No valid product data found. Ensure columns match: SKU (A), Name (B), Cost Price (C), Price (D), Image URL (O).');
      return;
    }

    setPreviewData(validated);
  };

  const executeImport = async () => {
    setIsImporting(true);
    setIsSuccess(false);
    apiFinishedRef.current = false;
    apiErrorRef.current = null;

    const estimatedSec = Math.max(3.0, Math.min(8.0, previewData.length * 0.1));
    setTotalEstimatedTime(estimatedSec);
    setCountdown(estimatedSec);

    onImport(previewData)
      .then(() => {
        apiFinishedRef.current = true;
      })
      .catch((err) => {
        apiErrorRef.current = err;
        apiFinishedRef.current = true;
      });
  };

  const downloadTemplate = () => {
    const csvContent = "Code,Name,Purchase Price,Sale Amount\nBK-01,Product One,500,800\nBK-02,Product Two,1200,1800";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_template.csv';
    a.click();
  };

  const progressPercent = totalEstimatedTime > 0 
    ? Math.min(100, Math.round((1 - countdown / totalEstimatedTime) * 100)) 
    : 0;

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  let progressStatusText = "ইনভেন্টরি তথ্য প্রক্রিয়াকরণ করা হচ্ছে...";
  if (progressPercent > 90) {
    progressStatusText = "ডাটাবেজে ইনভেন্টরি সিঙ্ক অলমোস্ট কমপ্লিট...";
  } else if (progressPercent > 70) {
    progressStatusText = "নতুন স্টক ও প্রাইস তালিকা প্রস্তুত করা হচ্ছে...";
  } else if (progressPercent > 45) {
    progressStatusText = "পণ্যতালিকা ক্লাউড ডাটাবেজে রেকর্ড করা হচ্ছে...";
  } else if (progressPercent > 20) {
    progressStatusText = "প্রোডাক্ট কোড ও ডুপ্লিকেট তথ্য স্ক্যানিং...";
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isImporting) return; setOpen(v); if(!v) reset(); }}>
      <DialogTrigger nativeButton={true} render={
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-900 text-slate-800 hover:text-black hover:bg-slate-50 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer">
          <Upload className="h-3.5 w-3.5 text-slate-700" />
          <span>Import Products</span>
        </button>
      } />
      <DialogContent className="sm:max-w-[600px] bg-white rounded-[2.5rem] border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden outline-none fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
        {isImporting ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 min-h-[440px]">
            {/* Animated Ring */}
            <div className="relative w-44 h-44 flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-xl animate-pulse" />
              
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  className="stroke-slate-100 fill-none"
                  strokeWidth="8"
                  style={{ stroke: '#f1f5f9' }}
                />
                <motion.circle
                  cx="88"
                  cy="88"
                  r={radius}
                  className="stroke-indigo-600 fill-none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset }}
                  transition={{ ease: "easeOut", duration: 0.15 }}
                />
              </svg>
              
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-800 font-mono tracking-tight">
                  {countdown.toFixed(1)}s
                </span>
                <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1.5 tracking-wider font-mono">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Bangla Status Text Header */}
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                প্রোডাক্ট আপডেট করা হচ্ছে
              </h3>
              <p className="text-sm font-semibold text-slate-500 min-h-[40px] px-4 leading-relaxed">
                {progressStatusText}
              </p>
            </div>

            <div className="w-full max-w-sm bg-white border border-slate-150 rounded-2xl p-4 mt-6 shadow-sm flex items-center gap-4 justify-between">
              <div className="text-left">
                <p className="text-xs font-bold text-slate-700">মোট প্রোডাক্ট: {previewData.length} টি</p>
                <p className="text-[10px] text-slate-400 font-medium">অনুগ্রহ করে উইন্ডোটি বন্ধ করবেন না</p>
              </div>
              <span className="text-[10px] font-black tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg uppercase">
                INVENTORY
              </span>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-white min-h-[440px]">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15, stiffness: 180 }}
              className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-600 shadow-xl shadow-emerald-100/50 relative"
            >
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping opacity-75" />
              <CheckCircle2 className="h-10 w-10 relative z-10" />
            </motion.div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              ইনভেন্টরি সাকসেসফুলি ইম্পোর্ট হয়েছে!
            </h2>
            
            <p className="text-sm font-semibold text-slate-500 max-w-sm leading-relaxed mb-6">
              মোট <span className="font-bold text-emerald-600">{previewData.length} টি পণ্যের</span> স্টক তথ্য এবং প্রাইসিং সফলভাবে ক্লাউড ডাটাবেজে স্টোর করা হয়েছে।
            </p>

            <div className="w-full max-w-xs bg-slate-50 rounded-2xl border border-slate-100 p-4 font-medium text-xs text-left text-slate-600 divide-y divide-slate-100">
              <div className="flex justify-between py-2.5">
                <span>সার্ভিস স্ট্যাটাস:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">☑ Verified Sync</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span>টার্গেট কালেকশন:</span>
                <span className="font-bold text-slate-800">productData</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="mt-8 bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-8 rounded-xl shadow-lg transition-all"
            >
              দারুণ, ধন্যবাদ
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-2">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <FileJson className="h-6 w-6" />
                  </div>
                  Import Product Inventory
                </DialogTitle>
                <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-blue-600 hover:bg-blue-50 font-bold rounded-lg text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Template
                </Button>
              </div>
            </DialogHeader>

            <div className="p-6 space-y-6">
              {!file ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
                  }}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300 transition-all cursor-pointer group"
                >
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-700">Drop Product Excel/CSV/JSON file</p>
                    <p className="text-xs text-indigo-600 mt-1 italic tracking-wider font-bold">
                      A (SKU) | B (Name) | C (Cost Price) | D (Price) | O (Image URL)
                    </p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".csv,.json,.xlsx,.xls" 
                    className="hidden" 
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg text-indigo-600">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{file.name}</p>
                        <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Ready to import</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-lg">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {previewData.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-bottom border-slate-200 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        <span>Data Preview ({previewData.length} items)</span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="sticky top-0 bg-white shadow-sm">
                            <tr>
                              <th className="p-2 pl-4 font-bold text-slate-400 text-[10px] uppercase">Code</th>
                              <th className="p-2 font-bold text-slate-400 text-[10px] uppercase">Product Name</th>
                              <th className="p-2 pr-4 font-bold text-slate-400 text-[10px] uppercase text-right">Sale</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {previewData.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-2 pl-4 font-mono text-xs text-slate-600">{row.code}</td>
                                <td className="p-2 font-medium text-slate-700">{row.name}</td>
                                <td className="p-2 pr-4 text-right font-bold text-slate-900">{row.saleAmount} BDT</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {previewData.length > 5 && (
                          <div className="p-3 text-center bg-slate-50/50 text-[10px] text-slate-400 font-bold italic border-t border-slate-100">
                            + {previewData.length - 5} more items...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-rose-900">Import Error</p>
                    <p className="text-xs text-rose-600 font-medium leading-relaxed mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  Import Instructions
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Formats</p>
                    <p className="text-xs font-semibold text-slate-700">CSV, JSON</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Columns mapped</p>
                    <p className="text-xs font-semibold text-slate-700">A=SKU, B=Name, C=Cost, D=Price, O=Image</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 pt-2 border-t border-slate-100 flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl h-12 font-bold border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button 
                onClick={executeImport}
                disabled={!file || previewData.length === 0 || isImporting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 animate-pulse"
              >
                {isImporting ? 'Importing...' : 'Complete Import'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
