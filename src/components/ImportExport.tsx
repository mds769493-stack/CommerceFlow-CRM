import React, { useState, useRef, useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { 
  Upload, 
  Download, 
  FileSpreadsheet,
  FileJson,
  FileText,
  X,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { FollowUp, Priority, Status, CallStatus } from '../types';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

interface ImportExportProps {
  onImport: (data: any[]) => Promise<void>;
  data: FollowUp[];
}

export function ImportExport({ onImport, data }: ImportExportProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [countdown, setCountdown] = useState<number>(0);
  const [totalEstimatedTime, setTotalEstimatedTime] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [importedCount, setImportedCount] = useState<number>(0);

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
          setError(`Failed to import follow-up data: ${apiErrorRef.current.message || String(apiErrorRef.current)}`);
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
    setPreviewData([]);

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result;
      let jsonData: any[] = [];

      try {
        if (isExcel) {
          const workbook = XLSX.read(content, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (rawData.length > 0) {
            jsonData = rawData.slice(1).map(row => ({
              A: row[0], // Column A
              C: row[2], // Column C
              H: row[7], // Column H
              K: row[10], // Column K
              O: row[14], // Column O
              S: row[18], // Column S
              _raw: row
            }));
            processImportedRawData(jsonData);
          } else {
            setError('Excel sheet is empty');
          }
        } else {
          if (typeof content !== 'string') return;
          Papa.parse(content, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
              const rawData = results.data as any[][];
              if (rawData.length > 0) {
                const rows = rawData.slice(1).map(row => ({
                  A: row[0],
                  C: row[2],
                  H: row[7],
                  K: row[10],
                  O: row[14],
                  S: row[18],
                  _raw: row
                }));
                processImportedRawData(rows);
              } else {
                setError('CSV file is empty');
              }
            },
            error: () => setError('Error parsing CSV file')
          });
        }
      } catch (err: any) {
        setError(`Error loading file content: ${err.message || String(err)}`);
      }
    };

    if (isExcel) {
      reader.readAsBinaryString(selectedFile);
    } else {
      reader.readAsText(selectedFile);
    }
  };

  const processImportedRawData = (rawData: any[]) => {
    const importedData = rawData.map((row: any) => {
      let orderId = row.A !== undefined ? String(row.A) : '';
      let consignmentId = row.S !== undefined ? String(row.S) : '';
      let phone = row.C !== undefined ? String(row.C) : '';
      let product = row.H !== undefined ? String(row.H) : '';
      let total = row.K !== undefined ? Number(row.K || 0) : 0;
      let dateValue = row.O !== undefined ? row.O : '';

      if (!orderId) orderId = row.OrderID || row.order_id || row.ID || row.id || '';
      if (!consignmentId) consignmentId = row.ConsignmentID || row.consignment_id || row.TrackingID || row.tracking_id || '';
      if (!dateValue) dateValue = row.Date || row.date;

      if (dateValue instanceof Date) {
        dateValue = dateValue.toISOString();
      } else if (!dateValue) {
        dateValue = new Date().toISOString();
      } else {
        try {
          dateValue = new Date(String(dateValue)).toISOString();
        } catch (e) {
          dateValue = new Date().toISOString();
        }
      }

      const orderIdClean = String(orderId || '').trim();
      const consignmentIdClean = String(consignmentId || '').trim();

      const isDuplicate = !!orderIdClean && data.some(f => (f.orderId || "").toLowerCase() === orderIdClean.toLowerCase());
      const isDuplicateConsignment = !!consignmentIdClean && data.some(f => (f.consignmentId || "").toLowerCase() === consignmentIdClean.toLowerCase());

      return {
        orderId: orderIdClean,
        consignmentId: consignmentIdClean,
        phone: String(phone || '').trim(),
        product: String(product || '').trim(),
        total: isNaN(total) ? 0 : total,
        priority: (row.Priority || row.priority || '') as Priority,
        date: dateValue,
        status: (row.Status || row.status || '') as Status,
        call: (row.Call || row.call || '') as CallStatus,
        callCount: Number(row.CallCount || row.call_count || row.callCount || 0),
        isMarked: row.IsMarked === 'true' || row.isMarked === 'true' || row.Mark === 'true' || row.mark === 'true',
        note: String(row.Note || row.note || ''),
        raiderCall: (row.RaiderCall || row.raider_call || row.RiderCall || row.rider_call || '') as CallStatus,
        raiderNote: String(row.RaiderNote || row.raider_note || row.RiderNote || row.rider_note || ''),
        isDuplicate,
        isDuplicateConsignment
      };
    }).filter(f => f.orderId || f.consignmentId);

    const duplicateCount = importedData.filter(f => f.isDuplicate || f.isDuplicateConsignment).length;
    if (duplicateCount > 0) {
      setError(`ফাইলটিতে ${duplicateCount}টি ডুপ্লিকেট এন্ট্রি পাওয়া গেছে যা ইতিমধ্যে সিস্টেমে বিদ্যমান। এগুলো ইম্পোর্ট করার সময় স্বয়ংক্রিয়ভাবে বাদ দেওয়া হবে।`);
    }

    if (importedData.length === 0) {
      setError('No valid follow-up entries found in the file. Ensure columns have OrderID or ConsignmentID values.');
      return;
    }

    setPreviewData(importedData);
  };

  const executeImport = async () => {
    // Filter out duplicates before importing
    const dataToImport = previewData.filter(f => !f.isDuplicate && !f.isDuplicateConsignment);
    
    if (dataToImport.length === 0) {
      setError("ফাইলটির সকল ডাটাই ইতিমধ্যে বিদ্যমান। কোনো নতুন ডাটা ইম্পোর্ট করার নেই।");
      return;
    }

    setIsImporting(true);
    setIsSuccess(false);
    apiFinishedRef.current = false;
    apiErrorRef.current = null;

    const estimatedSec = Math.max(3.0, Math.min(8.0, dataToImport.length * 0.12));
    setTotalEstimatedTime(estimatedSec);
    setCountdown(estimatedSec);
    setImportedCount(dataToImport.length);

    onImport(dataToImport)
      .then(() => {
        apiFinishedRef.current = true;
      })
      .catch((err) => {
        apiErrorRef.current = err;
        apiFinishedRef.current = true;
      });
  };

  const exportToExcel = () => {
    const exportData = data.map(({ internalId, createdAt, updatedAt, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Follow-Ups');
    XLSX.writeFile(workbook, `follow_ups_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadSampleCSV = () => {
    const headers = ['OrderID', 'ConsignmentID', 'Phone', 'Product', 'Total', 'Priority', 'Date', 'Status', 'Call', 'CallCount', 'IsMarked', 'Note', 'RaiderCall', 'RaiderNote'];
    const sampleRow = ['ORD-12345', 'PT12345678', '01700000000', 'Example Product', '1250', '', format(new Date(), "d MMMM yyyy"), '', '', '0', 'false', 'Sample note here', '', 'Raider note here'];
    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'follow_up_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progressPercent = totalEstimatedTime > 0 
    ? Math.min(100, Math.round((1 - countdown / totalEstimatedTime) * 100)) 
    : 0;

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  let progressStatusText = "ফলো-আপ রিপোর্ট লোড করা হচ্ছে...";
  if (progressPercent > 90) {
    progressStatusText = "ডাটাবেজে ফলো-আপ রেকর্ড আপডেট সম্পন্ন হচ্ছে...";
  } else if (progressPercent > 70) {
    progressStatusText = "গ্রাহকের যোগাযোগের বিবরণ প্রস্তুত করা হচ্ছে...";
  } else if (progressPercent > 45) {
    progressStatusText = "ইনভয়েস নম্বর ভিত্তিক লিংক ভেরিফাই করা হচ্ছে...";
  } else if (progressPercent > 20) {
    progressStatusText = "প্রাইওরিটি ও কল স্ট্যাটাস স্ক্যান করা হচ্ছে...";
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button
        variant="outline"
        onClick={downloadSampleCSV}
        className="h-11 rounded-[14px] px-5 gap-2.5 font-bold border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm active:scale-95 text-[11px] uppercase tracking-wider"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Template
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (isImporting) return; setOpen(v); if(!v) reset(); }}>
        <DialogTrigger nativeButton={true} render={
          <button className={cn(buttonVariants({ variant: "outline", className: "h-11 rounded-[14px] px-5 gap-2.5 font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 text-[11px] uppercase tracking-wider" }))}>
            <Upload className="h-4 w-4 text-slate-400" />
            Import File
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
                  ফলো-আপ সিঙ্ক হচ্ছে
                </h3>
                <p className="text-sm font-semibold text-slate-500 min-h-[40px] px-4 leading-relaxed">
                  {progressStatusText}
                </p>
              </div>

              <div className="w-full max-w-sm bg-white border border-slate-150 rounded-2xl p-4 mt-6 shadow-sm flex items-center gap-4 justify-between">
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-700">মোট ফলো-আপ: {previewData.length} টি</p>
                  <p className="text-[10px] text-slate-400 font-medium">অনুগ্রহ করে উইন্ডোটি বন্ধ করবেন না</p>
                </div>
                <span className="text-[10px] font-black tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg uppercase">
                  FOLLOWUPS
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
                ফলো-আপ ডাটা সাকসেসফুলি আপলোড হয়েছে!
              </h2>
              
              <p className="text-sm font-semibold text-slate-500 max-w-sm leading-relaxed mb-6">
                মোট <span className="font-bold text-emerald-600">{importedCount} টি ফলো-আপ রেকর্ড</span> সফলভাবে ডাটাবেজ কুইরিতে স্টোর করা হয়েছে।
              </p>

              <div className="w-full max-w-xs bg-slate-50 rounded-2xl border border-slate-100 p-4 font-medium text-xs text-left text-slate-600 divide-y divide-slate-100">
                <div className="flex justify-between py-2.5">
                  <span>সার্ভিস স্ট্যাটাস:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">☑ Verified Sync</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span>টার্গেট কালেকশন:</span>
                  <span className="font-bold text-slate-800">followUpData</span>
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
                    Import Follow-Up Data
                  </DialogTitle>
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
                      <p className="font-bold text-slate-700">Drop Follow-Up Excel/CSV file</p>
                      <p className="text-xs text-slate-400 mt-1 italic uppercase tracking-wider font-bold">OrderID or ConsignmentID values required</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".csv,.xlsx,.xls" 
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
                                <th className="p-2 pl-4 font-bold text-slate-400 text-[10px] uppercase">OrderID</th>
                                <th className="p-2 font-bold text-slate-400 text-[10px] uppercase">Phone</th>
                                <th className="p-2 pr-4 font-bold text-slate-400 text-[10px] uppercase text-right">Product</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {previewData.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-2 pl-4 font-mono text-xs text-slate-600">{row.orderId || row.consignmentId}</td>
                                  <td className="p-2 font-medium text-slate-700">{row.phone}</td>
                                  <td className="p-2 pr-4 text-right font-bold text-slate-900">{row.product || 'N/A'}</td>
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
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Import Instructions
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Formats</p>
                      <p className="text-xs font-semibold text-slate-700">CSV, Excel</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Required Fields</p>
                      <p className="text-xs font-semibold text-slate-700">OrderID / ConsignmentID</p>
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-blue-100 transition-all disabled:opacity-50 border-none"
                >
                  {isImporting ? 'Importing...' : 'Complete Import'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Button
        variant="outline"
        onClick={exportToExcel}
        className="h-11 rounded-[14px] px-5 gap-2.5 font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 text-[11px] uppercase tracking-wider"
      >
        <Download className="h-4 w-4 text-slate-400" />
        Export Excel
      </Button>
    </div>
  );
}
