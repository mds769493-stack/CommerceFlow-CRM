import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FollowUp, PRIORITY_COLORS, STATUS_COLORS, CALL_STATUS_COLORS, Priority, Status, CallStatus, ALL_STATUSES, ALL_CALL_STATUSES, LOCKED_STATUSES } from '../types';
import { format, parseISO, differenceInDays, startOfDay, isValid } from 'date-fns';
import { safeFormat, safeParseISO, safeDate } from '../lib/date-utils';
import { Search, Filter, Edit2, Check, X, Trash2, RefreshCw, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutDashboard, Copy, CheckCircle2, Lock, LockKeyholeOpen, History, Plus, ShieldCheck, Zap, Truck, Package, RotateCcw, XCircle, HelpCircle, DollarSign, Split, MapPin, Bike, Warehouse, PauseCircle, PackageOpen, ArrowRight, AlertCircle, Info, ExternalLink, PhoneCall } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function EditableNoteTextarea({
  value,
  onSave,
  placeholder,
  className
}: {
  value: string | undefined | null;
  onSave: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [localVal, setLocalVal] = useState(value || '');

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const lastSavedValRef = useRef(value || '');

  useEffect(() => {
    setLocalVal(value || '');
    lastSavedValRef.current = value || '';
  }, [value]);

  const handleSave = useCallback(() => {
    if (localVal !== lastSavedValRef.current) {
      lastSavedValRef.current = localVal;
      onSaveRef.current(localVal);
    }
  }, [localVal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== lastSavedValRef.current) {
        lastSavedValRef.current = localVal;
        onSaveRef.current(localVal);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localVal]);

  return (
    <Textarea
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleSave();
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

function EditableCallCountInput({
  value,
  onSave,
  className
}: {
  value: number | undefined | null;
  onSave: (val: number) => void;
  className?: string;
}) {
  const [localVal, setLocalVal] = useState(value?.toString() ?? '0');

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const lastSavedValRef = useRef(value || 0);

  useEffect(() => {
    setLocalVal(value?.toString() ?? '0');
    lastSavedValRef.current = value || 0;
  }, [value]);

  const handleSave = useCallback(() => {
    const num = parseInt(localVal, 10) || 0;
    if (num !== lastSavedValRef.current) {
      lastSavedValRef.current = num;
      onSaveRef.current(num);
    }
  }, [localVal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const num = parseInt(localVal, 10) || 0;
      if (num !== lastSavedValRef.current) {
        lastSavedValRef.current = num;
        onSaveRef.current(num);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localVal]);

  return (
    <Input
      type="number"
      min="0"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        }
      }}
      className={className}
    />
  );
}

interface FollowUpTableProps {
  followUps: FollowUp[];
  onUpdate: (internalId: string, updates: Partial<FollowUp>) => void;
  onUpdateMultiple: (internalIds: string[], updates: Partial<FollowUp>) => void;
  onDelete: (internalId: string) => void;
  onDeleteMultiple: (internalIds: string[]) => void;
  onSync: (internalId: string, id: string, type?: 'consignment_id' | 'order_id') => Promise<{ success: boolean; status?: Status; error?: string }>;
  onPreFetchRecentOrders?: (force?: boolean) => Promise<any[]>;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  defaultTab?: 'main' | 'others';
  isAutoSyncing?: boolean;
  activeTab: 'main' | 'others';
  setActiveTab: (tab: 'main' | 'others') => void;
}

const getStatusColorClass = (status: string | undefined | null) => {
  if (!status) return 'bg-slate-100 text-slate-700 border-slate-200';
  
  // Try exact match first
  if (STATUS_COLORS[status]) return STATUS_COLORS[status];
  
  // Try case-insensitive match
  const lowerStatus = (status || "").toLowerCase();
  const foundKey = Object.keys(STATUS_COLORS).find(k => (k || "").toLowerCase() === lowerStatus);
  
  if (foundKey) return STATUS_COLORS[foundKey];
  
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const STATUS_ICONS: Record<string, any> = {
  'Pending': Clock,
  'Done': CheckCircle2,
  'Cancelled': XCircle,
  'Return To Merchant': RotateCcw,
  'Delivered': CheckCircle2,
  'Paid Return': DollarSign,
  'Return': RotateCcw,
  'Exchange': RefreshCw,
  'Pickup Failed': HelpCircle,
  'In Transit': Truck,
  'Assigned For Delivery': Bike,
  'Return Requested': RotateCcw,
  'On Hold': PauseCircle,
  'At Delivery Hub': Warehouse,
  'Waiting for Pickup': PackageOpen,
  'On the Way To Delivery Hub': Truck,
  'Return In Transit': Truck,
  'At Sorting': MapPin,
  'At Sorting Hub': MapPin,
  'Partial Delivery': Split,
  'Assigned for Delivery': Bike,
  'Return At Sorting': MapPin,
  'Return At Sorting Hub': MapPin,
  'Return pending': Clock,
  'Reattempt Requested': RotateCcw,
  'Returned To Inventory': Warehouse,
  'Assigned for return': RotateCcw,
  'First Mile Hub': MapPin,
  'At Inventory': Warehouse,
  'Delivery': CheckCircle2,
  'Returned': RotateCcw,
  'In Review': AlertCircle,
};

const getStatusIcon = (status: string | undefined | null) => {
  if (!status) return Zap;
  
  // Try exact match first
  if (STATUS_ICONS[status]) return STATUS_ICONS[status];
  
  // Try case-insensitive match
  const lowerStatus = (status || "").toLowerCase();
  const foundKey = Object.keys(STATUS_ICONS).find(k => (k || "").toLowerCase() === lowerStatus);
  
  if (foundKey) return STATUS_ICONS[foundKey];
  
  return Zap;
};

export function FollowUpTable({ 
  followUps, 
  onUpdate, 
  onUpdateMultiple, 
  onDelete, 
  onDeleteMultiple, 
  onSync,
  onPreFetchRecentOrders,
  statusFilter: externalStatusFilter = 'all',
  onStatusFilterChange,
  defaultTab = 'main',
  isAutoSyncing = false,
  activeTab,
  setActiveTab
}: FollowUpTableProps) {
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(localSearch);
    }, 250);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [isBulkSyncingSelected, setIsBulkSyncingSelected] = useState(false);
  const [isResizeLocked, setIsResizeLocked] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [showDashboardHeader, setShowDashboardHeader] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [bulkSyncResults, setBulkSyncResults] = useState<{
    orderId: string;
    consignmentId: string;
    previousStatus: string;
    status: string;
    success: boolean;
    error?: string;
  }[]>([]);
  const [showBulkSyncSummary, setShowBulkSyncSummary] = useState(false);

  // Internal setter or external
  const setStatusFilter = (status: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(status);
    }
  };
  const statusFilter = externalStatusFilter;
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'marked', 'orderInfo', 'productSales', 'timeline', 'status', 'call', 'callActivity', 'note', 'raiderCall', 'raiderNote'
  ]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    marked: 50,
    orderInfo: 140,
    productSales: 160,
    timeline: 120,
    status: 130,
    call: 100,
    callActivity: 120,
    note: 220,
    raiderCall: 100,
    raiderNote: 180,
  });

  const activeResize = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  const onResizeStart = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activeResize.current = { col, startX: e.clientX, startWidth: columnWidths[col] };
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onResizeMove = (e: MouseEvent) => {
    const currentActive = activeResize.current;
    if (!currentActive) return;

    const { col, startX, startWidth } = currentActive;
    const delta = e.clientX - startX;
    const newWidth = Math.max(60, startWidth + delta);

    setColumnWidths(prev => ({
      ...prev,
      [col]: newWidth
    }));
  };

  const onResizeEnd = () => {
    activeResize.current = null;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const COLUMN_LABELS: Record<string, string> = {
    marked: 'Mark',
    orderInfo: 'Order Info',
    productSales: 'Product & Total',
    timeline: 'Timeline & Priority',
    status: 'Status',
    call: 'Call',
    callActivity: 'Call Activity',
    note: 'Note',
    raiderCall: 'Raider Call',
    raiderNote: 'Raider Note',
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col) 
        : [...prev, col]
    );
  };

  const scrollTable = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = 600;
      const target = direction === 'left' ? el.scrollLeft - scrollAmount : el.scrollLeft + scrollAmount;
      el.scrollTo({
        left: target,
        behavior: 'smooth'
      });
    }
  };

  const getDayColorClasses = (days: number) => {
    if (days <= 0) return "bg-slate-50 text-slate-600 border-slate-100";
    if (days <= 1) return "bg-blue-50 text-blue-700 border-blue-100";
    if (days <= 2) return "bg-yellow-50 text-yellow-700 border-yellow-100";
    if (days <= 4) return "bg-orange-50 text-orange-700 border-orange-100";
    if (days <= 7) return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-red-100 text-red-900 border-red-200 font-bold animate-pulse";
  };


  const COMPLETED_STATUSES: Status[] = [
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
    'Cancelled',
    'Lost'
  ];

  const filteredData = React.useMemo(() => {
    return followUps.filter((item) => {
      const searchL = (search || "").toLowerCase();
      const orderIdL = (item.orderId || "").toLowerCase();
      const consignmentIdL = (item.consignmentId || "").toLowerCase();
      const noteL = (item.note || "").toLowerCase();

      const matchesSearch = orderIdL.includes(searchL) || 
                           consignmentIdL.includes(searchL) || 
                           noteL.includes(searchL);
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      // Check if the item's status belongs to the current tab
      const isCompleted = item.status && COMPLETED_STATUSES.includes(item.status as Status);
      const matchesTab = activeTab === 'others' ? isCompleted : !isCompleted;

      return matchesSearch && matchesPriority && matchesStatus && matchesTab;
    }).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });
  }, [followUps, search, priorityFilter, statusFilter, activeTab]);



  // Calculate counts for tabs
  const { mainCount, othersCount } = React.useMemo(() => {
    let mc = 0;
    let oc = 0;
    for (const f of followUps) {
      if (f.status && COMPLETED_STATUSES.includes(f.status as Status)) {
        oc++;
      } else {
        mc++;
      }
    }
    return { mainCount: mc, othersCount: oc };
  }, [followUps]);

  // Pagination logic
  const totalItems = filteredData.length;
  const startIndex = React.useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
  const paginatedData = React.useMemo(() => filteredData.slice(startIndex, startIndex + itemsPerPage), [filteredData, startIndex, itemsPerPage]);
  const totalPages = React.useMemo(() => Math.max(1, Math.ceil(totalItems / itemsPerPage)), [totalItems, itemsPerPage]);

  const currentPageIds = paginatedData.map(item => item.internalId);
  const isPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.includes(id));
  const isPageIndeterminate = currentPageIds.some(id => selectedIds.includes(id)) && !isPageSelected;

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, priorityFilter, statusFilter, itemsPerPage]);

  const toggleSelectAll = () => {
    // Select all currently visible in pagination
    const currentPageIds = paginatedData.map(item => item.internalId);
    const allSelectedOnPage = currentPageIds.every(id => selectedIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const toggleSelect = (internalId: string) => {
    setSelectedIds(prev => 
      prev.includes(internalId) 
        ? prev.filter(id => id !== internalId) 
        : [...prev, internalId]
    );
  };

  const handleBulkDelete = () => {
    onDeleteMultiple(selectedIds);
    setSelectedIds([]);
  };

  const handleSync = async (internalId: string, item: FollowUp) => {
    const isLocked = item.status && LOCKED_STATUSES.includes(item.status as Status) && !unlockedIds.includes(internalId);
    if (isLocked) {
      return;
    }

    const idToUse = item.consignmentId || item.orderId;
    if (!idToUse) {
      return;
    }
    
    const type = item.consignmentId ? 'consignment_id' : 'order_id';
    const previousStatus = item.status || 'None';
    
    setSyncingId(internalId);
    const result = await onSync(internalId, idToUse, type);
    setSyncingId(null);

    const newStatus = result.status || (result.success ? 'Synced' : 'Failed');
    
    // Show popup for individual sync too
    setBulkSyncResults([{
      orderId: item.orderId,
      consignmentId: item.consignmentId,
      previousStatus: previousStatus,
      status: newStatus,
      success: result.success,
      error: result.error
    }]);
    setShowBulkSyncSummary(true);

    if (result.success) {
      if (result.status === 'Delivered' || result.status === 'Partial Delivery') {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#8b5cf6']
        });
      }
    }
  };

  const handleQuickSync = async () => {
    if (!localSearch.trim()) return;
    
    // Find the record locally - check both Order ID and Consignment ID
    const searchL = (localSearch || "").toLowerCase().trim();
    const existing = followUps.find(f => 
      (f.orderId || "").toLowerCase() === searchL || 
      (f.consignmentId || "").toLowerCase() === searchL
    );
    
    if (existing) {
      const isOrderId = (existing.orderId || "").toLowerCase() === searchL;
      const idToUse = isOrderId ? existing.orderId : existing.consignmentId;
      const type = isOrderId ? 'order_id' : 'consignment_id';
      const previousStatus = existing.status || 'None';

      setIsQuickSyncing(true);
      setBulkSyncResults([]);
      setShowBulkSyncSummary(true);
      
      const result = await onSync(existing.internalId, idToUse, type);
      setIsQuickSyncing(false);

      const newStatus = result.status || (result.success ? 'Synced' : 'Failed');
      
      // Even if status didn't change, for Quick Sync (single item search), showing the result is important
      setBulkSyncResults([{
        orderId: existing.orderId,
        consignmentId: existing.consignmentId,
        previousStatus: previousStatus,
        status: newStatus,
        success: result.success,
        error: result.error
      }]);

      if (result.success && (result.status === 'Delivered' || result.status === 'Partial Delivery')) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#8b5cf6']
        });
      }
    } else {
      console.warn('Record not found in local dashboard.');
    }
  };

  const toggleLock = (internalId: string) => {
    setUnlockedIds(prev => 
      prev.includes(internalId) 
        ? prev.filter(id => id !== internalId) 
        : [...prev, internalId]
    );
  };

  const handleSelectedSync = async () => {
    const targetIds = selectedIds.length > 0 ? selectedIds : paginatedData.map(p => p.internalId);
    
    const itemsToSync = followUps.filter(f => {
      const isLocked = f.status && LOCKED_STATUSES.includes(f.status as Status) && !unlockedIds.includes(f.internalId);
      return targetIds.includes(f.internalId) && !isLocked;
    });
    
    if (itemsToSync.length === 0) {
      return;
    }

    setIsBulkSyncingSelected(true);
    setBulkSyncResults([]);
    setShowBulkSyncSummary(true);

    // Pre-fetch and cache recent orders to accelerate the sync process and bypass rate limiting
    if (onPreFetchRecentOrders) {
      try {
        await onPreFetchRecentOrders(true);
      } catch (err) {
        console.error("Failed to pre-fetch recent orders for bulk sync:", err);
      }
    }

    let successCount = 0;
    
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Parallel sync with concurrency limit and delay
    const batchSize = 2; // Reduced from 5 to 2
    for (let i = 0; i < itemsToSync.length; i += batchSize) {
      const batch = itemsToSync.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item) => {
        const idToUse = item.consignmentId || item.orderId;
        if (!idToUse) return;
        
        const type = item.consignmentId ? 'consignment_id' : 'order_id';
        const previousStatus = item.status || 'None';
        setSyncingId(item.internalId);
        
        try {
          const result = await onSync(item.internalId, idToUse, type);
          const newStatus = result.status || (result.success ? 'Synced' : 'Failed');
          
          if (newStatus !== previousStatus || !result.success) {
            setBulkSyncResults(prev => [...prev, {
              orderId: item.orderId,
              consignmentId: item.consignmentId,
              previousStatus: previousStatus,
              status: newStatus,
              success: result.success,
              error: result.error
            }]);
          }
          if (result.success) successCount++;
        } catch (err) {
          setBulkSyncResults(prev => [...prev, {
            orderId: item.orderId,
            consignmentId: item.consignmentId,
            previousStatus: previousStatus,
            status: 'Error',
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          }]);
        }
      }));

      // Since cache hits are instantaneous, we only need a tiny pause to allow UI thread breathing room
      if (i + batchSize < itemsToSync.length) {
        await sleep(100); 
      }
    }
    
    setSyncingId(null);
    setIsBulkSyncingSelected(false);
    setSelectedIds([]);
    
    if (successCount > 0) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#8b5cf6']
      });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Calculate completion stats for the "Progress Console"
  const stats = useMemo(() => {
    const total = followUps.length;
    const completed = followUps.filter(f => f.status && COMPLETED_STATUSES.includes(f.status as Status)).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, pending, percentage };
  }, [followUps]);

  // Dynamically calculate statuses present in current board and their counts
  const statusStats = useMemo(() => {
    const boardFollowUps = followUps.filter(f => {
      const isCompleted = f.status && COMPLETED_STATUSES.includes(f.status as Status);
      return activeTab === 'others' ? isCompleted : !isCompleted;
    });
    
    const counts: Record<string, number> = {};
    boardFollowUps.forEach(f => {
      if (f.status) {
        counts[f.status] = (counts[f.status] || 0) + 1;
      }
    });
    
    return {
      total: boardFollowUps.length,
      counts: Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
    };
  }, [followUps, activeTab]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <Popover>
            <PopoverTrigger nativeButton={true} render={
              <button className={cn(buttonVariants({ variant: "outline", size: "sm", className: "h-11 px-5 border-slate-200 text-slate-600 shrink-0 text-[11px] font-bold uppercase tracking-wider rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all" }))}>
                <Filter className="mr-2.5 h-4 w-4" />
                Columns
              </button>
            } />
            <PopoverContent className="w-64 p-3 bg-white rounded-2xl border-slate-200 shadow-xl" align="start">
              <div className="space-y-2">
                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">Display Settings</div>
                <div className="grid gap-1">
                  {Object.entries(COLUMN_LABELS).map(([id, label]) => (
                    <div 
                      key={id}
                      onClick={() => toggleColumn(id)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all text-[11px] font-medium",
                        visibleColumns.includes(id) ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-500"
                      )}
                    >
                      <Checkbox 
                        checked={visibleColumns.includes(id)} 
                        className="h-4 w-4 rounded-md border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        onCheckedChange={() => {}} 
                      />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="relative flex-1 max-w-[320px] group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <Input
              placeholder="Search anything..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-11 h-11 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-sm rounded-xl placeholder:text-slate-400 placeholder:font-medium"
            />
            {localSearch.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                onClick={handleQuickSync}
                disabled={isQuickSyncing}
              >
                {isQuickSyncing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectedSync}
              disabled={isBulkSyncingSelected}
              className={cn(
                "h-11 px-6 font-bold text-[11px] tracking-widest rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 border-none",
                selectedIds.length > 0 
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100" 
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              )}
            >
              <RefreshCw className={cn("mr-2.5 h-4 w-4", isBulkSyncingSelected && "animate-spin")} />
              {selectedIds.length > 0 ? `Sync Selected (${selectedIds.length})` : "Sync Visible"}
            </Button>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
                <Select onValueChange={(val) => {
                  if (val) {
                    onUpdateMultiple(selectedIds, { status: val as Status });
                    setSelectedIds([]);
                  }
                }}>
                  <SelectTrigger className="w-[150px] bg-slate-100/50 border-slate-200 text-slate-700 h-11 font-bold text-[11px] rounded-xl hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] rounded-2xl border-slate-200 shadow-2xl p-2">
                    {ALL_STATUSES.map(status => (
                      <SelectItem key={status} value={status} className="text-[11px] font-bold py-2.5 px-4 rounded-xl focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select onValueChange={(val) => {
                  if (val) {
                    onUpdateMultiple(selectedIds, { priority: val as Priority });
                    setSelectedIds([]);
                  }
                }}>
                  <SelectTrigger className="w-[130px] bg-slate-100/50 border-slate-200 text-slate-700 h-11 font-bold text-[11px] rounded-xl hover:bg-slate-100 transition-colors">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 shadow-2xl p-2">
                    <SelectItem value="High" className="text-[11px] font-bold py-2.5 px-4 rounded-xl text-rose-600 focus:bg-rose-50 cursor-pointer">High</SelectItem>
                    <SelectItem value="Medium" className="text-[11px] font-bold py-2.5 px-4 rounded-xl text-amber-600 focus:bg-amber-50 cursor-pointer">Medium</SelectItem>
                    <SelectItem value="Low" className="text-[11px] font-bold py-2.5 px-4 rounded-xl text-indigo-600 focus:bg-indigo-50 cursor-pointer">Low</SelectItem>
                  </SelectContent>
                </Select>

                <AlertDialog>
                  <AlertDialogTrigger nativeButton={true} render={
                    <button className={cn(buttonVariants({ variant: "destructive", size: "sm", className: "h-11 w-11 p-0 rounded-xl shadow-sm hover:bg-rose-600 border-none transition-all active:scale-90 flex items-center justify-center" }))}>
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  } />
                  <AlertDialogContent className="bg-white border-none shadow-2xl rounded-[2.5rem] p-10 max-w-md fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
                    <AlertDialogHeader>
                      <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                        <Trash2 className="w-8 h-8" />
                      </div>
                      <AlertDialogTitle className="text-2xl font-bold text-slate-900 text-center">Confirm Deletion</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-500 font-medium text-center mt-2 leading-relaxed">
                        You are about to permanently delete <span className="font-bold text-rose-600">{selectedIds.length} records</span>. This action is irreversible and will remove them from the dashboard.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-3">
                      <AlertDialogCancel className="flex-1 bg-slate-100 border-none text-slate-600 font-bold text-[11px] uppercase tracking-widest h-14 rounded-2xl hover:bg-slate-200 transition-all">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleBulkDelete}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] uppercase tracking-widest h-14 rounded-2xl shadow-lg shadow-rose-200 transition-all"
                      >
                        Delete Records
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100/50 rounded-2xl p-1.5 border border-slate-200/60 shadow-sm">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 bg-white shadow-sm hover:bg-white hover:text-blue-600 active:scale-90 transition-all rounded-xl text-slate-600"
                onClick={() => scrollTable('left')}
                title="Previous"
                type="button"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="w-px h-6 bg-slate-200 mx-1.5" />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 bg-white shadow-sm hover:bg-white hover:text-blue-600 active:scale-90 transition-all rounded-xl text-slate-600"
                onClick={() => scrollTable('right')}
                title="Next"
                type="button"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />
          </div>

          <div className="flex items-center gap-3">
            <Select 
              value={statusFilter} 
              onValueChange={(val) => setStatusFilter(val as Status | 'all')}
            >
              <SelectTrigger className="w-[145px] bg-white border-slate-200 text-slate-700 h-10 font-bold text-[10px] rounded-xl shadow-sm hover:border-slate-300 transition-all">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <SelectValue placeholder="Filter Status" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 shadow-2xl p-2">
                <SelectItem value="all" className="text-[11px] font-bold py-2.5 px-4 rounded-xl focus:bg-blue-50 cursor-pointer">All Status</SelectItem>
                {ALL_STATUSES.map(status => (
                  <SelectItem key={status} value={status} className="text-[11px] font-bold py-2.5 px-4 rounded-xl focus:bg-blue-50 cursor-pointer">{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={priorityFilter} 
              onValueChange={(val) => setPriorityFilter(val as Priority | 'all')}
            >
              <SelectTrigger className="w-[145px] bg-white border-slate-200 text-slate-700 h-10 font-bold text-[10px] rounded-xl shadow-sm hover:border-slate-300 transition-all">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <SelectValue placeholder="Filter Priority" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-200 shadow-2xl p-2">
                <SelectItem value="all" className="text-[11px] font-bold py-2.5 px-4 rounded-xl focus:bg-blue-50 cursor-pointer">All Priority</SelectItem>
                <SelectItem value="High" className="text-[11px] font-bold py-2.5 px-4 rounded-xl text-rose-600 focus:bg-rose-50 cursor-pointer">High</SelectItem>
                <SelectItem value="Medium" className="text-[11px] font-bold py-2.5 px-4 rounded-xl text-amber-600 focus:bg-amber-50 cursor-pointer">Medium</SelectItem>
                <SelectItem value="Low" className="text-[11px] font-bold py-2.5 px-4 rounded-xl text-indigo-600 focus:bg-indigo-50 cursor-pointer">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>

      {/* QUICK STATUS ACTIONS BAR */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-wrap items-center gap-1.5 p-2.5 bg-white/40 backdrop-blur-md rounded-2xl border border-white shadow-lg shadow-slate-200/20"
      >
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200/60 mr-1 shrink-0">
          <div className={cn(
            "p-1.5 rounded-lg shadow-sm transition-colors",
            selectedIds.length > 0 ? "bg-blue-600 text-white" : "bg-white text-slate-400"
          )}>
            <Zap className={cn("w-3.5 h-3.5", selectedIds.length > 0 && "animate-pulse")} />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black capitalize text-slate-400 tracking-[0.15em] leading-none">
              Status Engine
            </span>
            <span className="text-[10px] font-bold text-slate-600 mt-0.5">
              {selectedIds.length > 0 ? `Update ${selectedIds.length} Selected` : 'Quick Analytics'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shadow-sm flex items-center gap-2",
              statusFilter === 'all' 
                ? "bg-slate-900 text-white border-slate-900 scale-[1.05] shadow-lg shadow-slate-300" 
                : "bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            All Board
            <span className={cn(
              "px-2 py-0.5 rounded-lg text-[10px] font-black shadow-inner",
              statusFilter === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-900"
            )}>
              {statusStats.total}
            </span>
          </button>

          {statusStats.counts.map(([status, count]) => {
            const isActive = statusFilter === status;
            const colorClass = getStatusColorClass(status);
            const StatusIcon = getStatusIcon(status);
            
            return (
              <button
                key={status}
                onClick={() => {
                  if (selectedIds.length > 0) {
                    onUpdateMultiple(selectedIds, { status: status as Status });
                    setSelectedIds([]);
                  } else {
                    setStatusFilter(isActive ? 'all' : status);
                  }
                }}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap shadow-sm group flex items-center gap-2",
                  colorClass,
                  isActive 
                    ? "shadow-md scale-[1.02] ring-2 ring-offset-1 ring-blue-500/30"
                    : "opacity-80 hover:opacity-100 hover:shadow-md border-transparent hover:border-white/50"
                )}
              >
                <motion.div
                  animate={isActive ? { 
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.2, 1]
                  } : { 
                    rotate: 0,
                    scale: 1
                  }}
                  transition={{ 
                    duration: 0.5,
                    repeat: isActive ? Infinity : 0,
                    repeatDelay: 2
                  }}
                  className="shrink-0"
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                </motion.div>
                <span>{status}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-black transition-colors shadow-sm",
                  isActive ? "bg-black/20" : "bg-white/40 text-black group-hover:bg-white/60"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className={cn(
        "rounded-[1.5rem] border transition-all duration-700 overflow-hidden relative group shadow-2xl shadow-slate-200/40",
        activeTab === 'main' ? "border-slate-100 bg-white" : "border-amber-100 bg-amber-50/20"
      )}>
        {/* Subtle Inner Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
        
        {/* Desktop View */}
        <Table 
          ref={scrollContainerRef}
          className="table-fixed border-separate border-spacing-0 w-full"
          containerClassName="custom-scrollbar scroll-smooth overflow-x-auto overflow-y-auto relative max-h-[750px]"
        >
          <TableHeader className="sticky top-0 z-30 bg-white">
              <TableRow className="hover:bg-transparent border-b border-slate-200 flex w-full min-w-[1600px] h-14">
                <TableHead key="checkbox-header" className="w-[48px] min-w-[48px] max-w-[48px] px-2 h-14 text-center sticky left-0 z-40 bg-white flex items-center justify-center border-r border-slate-200">
                  <div className="flex justify-center">
                    <Checkbox 
                      checked={isPageSelected ? true : (isPageIndeterminate ? 'indeterminate' as any : false)}
                      onCheckedChange={toggleSelectAll}
                      className={cn(
                        "rounded-md transition-all shadow-sm data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600",
                        activeTab === 'others' && "border-amber-300 data-[state=checked]:bg-amber-600"
                      )}
                    />
                  </div>
                </TableHead>
                {Object.keys(COLUMN_LABELS).map((col) => {
                  if (!visibleColumns.includes(col)) return null;
                  const width = columnWidths[col];
                  return (
                    <TableHead 
                      key={col}
                      className="font-black text-[9px] capitalize tracking-widest text-slate-400/80 border-r border-slate-200 p-0 overflow-hidden relative h-14 flex items-center grow-0 shrink-0"
                      style={{ width, minWidth: width, maxWidth: width }}
                    >
                      <div className="flex items-center h-full px-2 py-2 select-none w-full">
                        <span className="truncate">{COLUMN_LABELS[col]}</span>
                      </div>
                    </TableHead>
                  );
                })}
                <TableHead key="action-header" className="w-[120px] min-w-[120px] max-w-[120px] text-right font-black text-[9px] uppercase tracking-widest text-slate-400/80 h-14 flex items-center justify-end sticky right-0 z-40 bg-white shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-200 pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow key="empty-row" className="flex w-full">
                  <TableCell colSpan={visibleColumns.length + 2} className="h-64 flex-1 flex flex-col items-center justify-center bg-white border-y border-slate-100">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-30 scale-75">
                      <div className="p-4 bg-slate-50 rounded-3xl">
                        <Search className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Vault is empty</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item) => {
                  const isSelected = selectedIds.includes(item.internalId);
                  const isLocked = item.status && LOCKED_STATUSES.includes(item.status as Status) && !unlockedIds.includes(item.internalId);
                  
                  return (
                    <TableRow 
                      key={item.internalId} 
                      className={cn(
                        "group/row transition-all duration-300 border-b border-slate-200 relative flex w-full min-w-[1600px] h-14",
                        isSelected 
                          ? (activeTab === 'main' ? "bg-blue-50/20" : "bg-amber-50/30") 
                          : "bg-white hover:bg-slate-50/20"
                      )}
                    >
                      <TableCell className="w-[48px] min-w-[48px] max-w-[48px] p-0 text-center sticky left-0 z-10 bg-white group-hover/row:bg-slate-50 transition-colors border-r border-slate-200 flex items-center justify-center shadow-[2px_0_5px_rgba(0,0,0,0.05)] h-14">
                        <div className="flex justify-center">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(item.internalId)}
                            className={cn(
                              "h-3.5 w-3.5 rounded shadow-sm transition-all data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600",
                              activeTab === 'others' && "border-amber-300 data-[state=checked]:bg-amber-600"
                            )}
                          />
                        </div>
                      </TableCell>
                      {visibleColumns.includes('marked') && (
                        <TableCell style={{ width: columnWidths['marked'], minWidth: columnWidths['marked'], maxWidth: columnWidths['marked'] }} className="p-0 border-r border-slate-200 flex items-center justify-center grow-0 shrink-0 h-14 overflow-hidden">
                          <button
                            onClick={() => onUpdate(item.internalId, { isMarked: !item.isMarked })}
                            className={cn(
                              "h-7 w-7 flex items-center justify-center rounded-lg transition-all",
                              item.isMarked 
                                ? "bg-emerald-500 text-white shadow-md shadow-emerald-200 scale-110" 
                                : "bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-400"
                            )}
                          >
                            <CheckCircle2 className={cn("h-4 w-4", item.isMarked ? "animate-in zoom-in-50" : "")} />
                          </button>
                        </TableCell>
                      )}
                      {visibleColumns.includes('orderInfo') && (
                        <TableCell 
                          style={{ width: columnWidths['orderInfo'], minWidth: columnWidths['orderInfo'], maxWidth: columnWidths['orderInfo'] }}
                          className="p-1 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden"
                        >
                          <div className="flex flex-col gap-0.5 w-full px-2">
                            <div className="flex items-center gap-1 group/id">
                              <span className="text-[9px] font-black text-blue-600 tracking-tight truncate flex-1 bg-blue-50/50 px-1.5 py-0 rounded border border-blue-100 tabular-nums capitalize">{item.orderId || '---'}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopy(item.orderId, `${item.internalId}-order`)}
                                className={cn(
                                  "h-3 w-3 opacity-0 group-hover/id:opacity-100 transition-all",
                                  copiedId === `${item.internalId}-order` && "opacity-100 text-emerald-500"
                                )}
                              >
                                {copiedId === `${item.internalId}-order` ? <CheckCircle2 className="h-2 w-2" /> : <Copy className="h-2 w-2 opacity-40 hover:opacity-100" />}
                              </Button>
                            </div>
                            <div className="flex items-center gap-1 group/consign">
                              <span className="text-[8px] font-mono font-black text-slate-400 truncate flex-1 bg-slate-50 px-1.5 py-0 rounded border border-slate-100 tabular-nums tracking-tighter">{item.consignmentId || '---'}</span>
                              {item.consignmentId && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleCopy(item.consignmentId, `${item.internalId}-consign`)}
                                    className={cn(
                                      "h-3 w-3",
                                      copiedId === `${item.internalId}-consign` && "opacity-100 text-emerald-500"
                                    )}
                                  >
                                    {copiedId === `${item.internalId}-consign` ? <CheckCircle2 className="h-2 w-2" /> : <Copy className="h-2 w-2 opacity-40" />}
                                  </Button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const url = `https://merchant.pathao.com/tracking?consignment_id=${item.consignmentId}&phone=${item.phone || ''}`;
                                      const w = 560;
                                      const h = 850;
                                      const left = (window.screen.width / 2) - (w / 2);
                                      const top = (window.screen.height / 2) - (h / 2);
                                      window.open(url, 'PathaoTracking', `width=${w},height=${h},top=${top},left=${left},scrollbars=yes,resizable=yes`);
                                    }}
                                    className="h-5 w-5 flex items-center justify-center bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
                                    title="Track on Pathao"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 group/phone">
                              <span className="text-[9px] font-bold text-slate-800 tracking-tight truncate flex-1 capitalize">{item.phone || '---'}</span>
                              {item.phone && (
                                <div className="flex items-center gap-1">
                                  <a 
                                    href={`tel:${item.phone}`}
                                    className="h-5 w-5 flex items-center justify-center bg-emerald-500 text-white rounded shadow-sm hover:bg-emerald-600 transition-colors"
                                    title="Call now"
                                  >
                                    <PhoneCall className="h-3 w-3" />
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleCopy(item.phone, `${item.internalId}-phone`)}
                                    className={cn(
                                      "h-3 w-3 opacity-0 group-hover/phone:opacity-100 transition-all",
                                      copiedId === `${item.internalId}-phone` && "opacity-100 text-emerald-500"
                                    )}
                                  >
                                    {copiedId === `${item.internalId}-phone` ? <CheckCircle2 className="h-2 w-2" /> : <Copy className="h-2 w-2 opacity-40 hover:opacity-100" />}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.includes('productSales') && (
                        <TableCell 
                          style={{ width: columnWidths['productSales'], minWidth: columnWidths['productSales'], maxWidth: columnWidths['productSales'] }}
                          className="p-1 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden"
                        >
                          <div className="px-2 w-full flex flex-col gap-1 justify-center">
                            <span className="text-[9px] font-bold text-slate-700 truncate capitalize leading-tight line-clamp-2 h-auto" title={item.product}>{item.product || '---'}</span>
                            <div className="flex items-center justify-between">
                              <span className="text-[7px] font-black text-slate-400 capitalize tracking-widest">Total:</span>
                              <span className="text-[10px] font-black text-[#008060] tabular-nums">{item.total ? `৳${item.total}` : '---'}</span>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.includes('timeline') && (
                        <TableCell 
                          style={{ width: columnWidths['timeline'], minWidth: columnWidths['timeline'], maxWidth: columnWidths['timeline'] }} 
                          className="p-1 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden"
                        >
                          <div className="flex flex-col gap-1 w-full px-1">
                            <div className="flex items-center justify-between">
                              <Select
                                value={item.priority || ""}
                                onValueChange={(v: Priority | '') => onUpdate(item.internalId, { priority: v })}
                              >
                                <SelectTrigger className={cn(
                                  "h-5 flex-1 border-transparent hover:border-slate-200 transition-all font-black px-1.5 rounded-md bg-transparent hover:bg-white focus:bg-white text-[8px] capitalize tracking-tighter shadow-none",
                                  item.priority && PRIORITY_COLORS[item.priority as Priority]
                                )}>
                                  <SelectValue placeholder="PRI" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                  <SelectItem value="" className="text-[10px] font-black uppercase">None</SelectItem>
                                  <SelectItem value="High" className="text-[10px] font-black uppercase text-red-600">High</SelectItem>
                                  <SelectItem value="Medium" className="text-[10px] font-black uppercase text-amber-600">Medium</SelectItem>
                                  <SelectItem value="Low" className="text-[10px] font-black uppercase text-blue-600">Low</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              {(() => {
                                try {
                                  const parsedDate = safeDate(item.date);
                                  if (!parsedDate) throw new Error('Invalid date');
                                  const days = differenceInDays(startOfDay(new Date()), startOfDay(parsedDate));
                                  return (
                                    <div className={cn(
                                      "flex items-center px-1.5 py-0 rounded-full border text-[7px] font-black tabular-nums transition-all truncate capitalize tracking-tighter h-4 ml-1",
                                      getDayColorClasses(days),
                                      "border-white/40 shadow-sm"
                                    )}>
                                      {days}D
                                    </div>
                                  );
                                } catch {
                                  return null;
                                }
                              })()}
                            </div>
                            
                            <Popover>
                              <PopoverTrigger nativeButton={true} render={
                                <button
                                  className={cn(
                                    buttonVariants({ variant: "ghost", className: "h-5 w-full justify-start text-left font-black border-transparent hover:border-slate-200 hover:bg-white rounded-md transition-all px-1.5 shadow-none" }),
                                    !item.date && "text-slate-300"
                                  )}
                                >
                                  <CalendarIcon className="mr-1 h-2.5 w-2.5 opacity-30" />
                                  <span className="text-[8px] capitalize tracking-tighter tabular-nums whitespace-nowrap">{safeFormat(item.date, "dd MMM yy", "Date")}</span>
                                </button>
                              } />
                              <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
                                <Calendar
                                  mode="single"
                                  selected={safeParseISO(item.date)}
                                  onSelect={(date) => date && onUpdate(item.internalId, { date: date.toISOString() })}
                                  initialFocus
                                  className="rounded-2xl"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.includes('status') && (
                        <TableCell style={{ width: columnWidths['status'], minWidth: columnWidths['status'], maxWidth: columnWidths['status'] }} className="p-0 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden">
                          {(() => {
                            const isLockedStatus = item.status && LOCKED_STATUSES.includes(item.status as Status) && !unlockedIds.includes(item.internalId);
                            const currentStatusValue = item.status || "";
                            
                            return (
                                <Popover open={isUpdatingStatus === item.internalId} onOpenChange={(open) => setIsUpdatingStatus(open ? item.internalId : null)}>
                                  <PopoverTrigger nativeButton={true} render={
                                    <button
                                      disabled={isLockedStatus as boolean}
                                      className={cn(
                                        "h-7 flex-1 flex items-center justify-between border-transparent hover:border-slate-200 transition-all font-black px-2 mx-1 rounded-lg bg-transparent hover:bg-white text-[8px] capitalize tracking-tighter shadow-sm min-w-0 truncate",
                                        getStatusColorClass(currentStatusValue),
                                        isLockedStatus && "opacity-80 cursor-not-allowed grayscale-[0.2]"
                                      )}
                                    >
                                      <div className="flex items-center gap-1 truncation overflow-hidden">
                                        {isLockedStatus && <Lock className="h-2 w-2 text-slate-500/50 shrink-0" />}
                                        <span className="truncate">{currentStatusValue || "---"}</span>
                                      </div>
                                      <Zap className={cn("h-2.5 w-2.5 shrink-0 ml-1 opacity-40 group-hover/row:opacity-100 transition-opacity", isUpdatingStatus === item.internalId && "text-blue-600 opacity-100 animate-pulse")} />
                                    </button>
                                  } />
                                  <PopoverContent className="w-72 p-2 bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl rounded-2xl" align="start">
                                    <div className="px-2 py-1.5 mb-2 border-b border-slate-100 flex items-center justify-between">
                                      <span className="text-[9px] font-black capitalize text-slate-400 tracking-widest">Fast Status Update</span>
                                      <div className="flex items-center gap-1">
                                         <Zap className="h-3 w-3 text-blue-600 animate-pulse" />
                                         <span className="text-[8px] font-bold text-blue-600">Sync Pathao</span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[300px] pr-1">
                                      {ALL_STATUSES.map((status) => (
                                        <button
                                          key={status}
                                          onClick={() => {
                                            onUpdate(item.internalId, { status: status as Status });
                                            setIsUpdatingStatus(null);
                                          }}
                                          className={cn(
                                            "flex items-center gap-2 px-2.5 py-2 rounded-xl text-[9px] font-black capitalize tracking-wider text-left transition-all border shadow-sm hover:scale-[1.02] active:scale-95",
                                            getStatusColorClass(status),
                                            currentStatusValue === status ? "ring-2 ring-blue-500/50 scale-[1.02] shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                                          )}
                                        >
                                          {React.createElement(getStatusIcon(status), { className: "w-3 h-3 shrink-0" })}
                                          <span className="truncate">{status}</span>
                                        </button>
                                      ))}
                                      <button
                                        onClick={() => {
                                          onUpdate(item.internalId, { status: '' });
                                          setIsUpdatingStatus(null);
                                        }}
                                        className="col-span-2 mt-1 flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-xl text-[9px] font-black capitalize tracking-wider text-slate-400 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        Reset to None
                                      </button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                            );
                          })()}
                        </TableCell>
                      )}
                      {visibleColumns.includes('call') && (
                        <TableCell style={{ width: columnWidths['call'], minWidth: columnWidths['call'], maxWidth: columnWidths['call'] }} className="p-0 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden">
                          <Select
                            value={item.call || ''}
                            onValueChange={(v: CallStatus | '') => onUpdate(item.internalId, { call: v })}
                          >
                            <SelectTrigger className={cn(
                              "h-7 w-full border-transparent hover:border-slate-200 transition-all font-black px-1.5 mx-1 rounded-lg bg-transparent hover:bg-white focus:bg-white text-[8px] capitalize tracking-tighter shadow-none",
                              item.call && CALL_STATUS_COLORS[item.call as CallStatus]
                            )}>
                              <SelectValue placeholder="---" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                              <SelectItem value="" className="text-[9px] font-black capitalize">None</SelectItem>
                              {ALL_CALL_STATUSES.map((status) => (
                                <SelectItem key={status} value={status} className="text-[9px] font-black capitalize tracking-tighter">
                                  <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black capitalize", CALL_STATUS_COLORS[status])}>
                                    {status}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      {visibleColumns.includes('callActivity') && (
                        <TableCell style={{ width: columnWidths['callActivity'], minWidth: columnWidths['callActivity'], maxWidth: columnWidths['callActivity'] }} className="p-0 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden">
                          <div className="flex items-center gap-1 w-full px-1">
                            <EditableCallCountInput
                              value={item.callCount}
                              onSave={(val) => onUpdate(item.internalId, { callCount: val })}
                              className="h-7 w-10 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent hover:bg-white focus:bg-white px-1 text-center text-[9px] font-black rounded-lg transition-all shadow-none tabular-nums"
                            />
                            <Popover>
                              <PopoverTrigger nativeButton={true} render={
                                <button 
                                  className={cn(
                                    buttonVariants({ variant: "ghost", size: "sm", className: "h-7 flex-1 rounded-lg font-black text-[9px] uppercase border-transparent hover:border-slate-200 transition-all shadow-none px-1" }),
                                    (item.history?.length || 0) > 0 
                                      ? (activeTab === 'main' ? "bg-blue-50 text-blue-700 font-black" : "bg-amber-50 text-amber-700 font-black") 
                                      : "text-slate-400 bg-transparent"
                                  )}>
                                  <History className="mr-1 h-3 w-3 opacity-60" />
                                  {item.history?.length || 0}L
                                </button>
                              } />
                              <PopoverContent className="w-96 p-0 bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-slate-200 rounded-3xl overflow-hidden" align="center">
                                <div className={cn(
                                  "p-4 border-b border-slate-100 flex items-center justify-between",
                                  activeTab === 'main' ? "bg-blue-50/50" : "bg-amber-50/50"
                                )}>
                                  <div className="space-y-0.5">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Interaction Log</h4>
                                    <p className="text-[9px] text-slate-400 font-bold tracking-tight">Timeline of updates</p>
                                  </div>
                                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                    <History className={cn("w-3.5 h-3.5", activeTab === 'main' ? "text-blue-600" : "text-amber-600")} />
                                  </div>
                                </div>
                                <div className="max-h-[250px] overflow-y-auto p-4 space-y-4 relative">
                                  {(!item.history || item.history.length === 0) ? (
                                    <div className="text-center py-6">
                                      <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Clock className="w-5 h-5 text-slate-300" />
                                      </div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empty log</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      {[...item.history].reverse().map((h, i) => (
                                        <div key={`${h.updatedAt}-${i}`} className="group/log relative pl-5 border-l border-slate-100 pb-1 hover:border-blue-400 transition-colors">
                                          <div className="absolute -left-[4.5px] top-0 w-2 h-2 rounded-full bg-white border-2 border-slate-200 group-hover/log:border-blue-400 group-hover/log:scale-125 transition-all" />
                                          <div className="flex justify-between items-start mb-1.5">
                                            <div className="flex flex-col">
                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                {safeFormat(h.updatedAt, 'MMM dd, HH:mm')}
                                              </p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                              {h.status && (
                                                <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider", STATUS_COLORS[h.status] || 'bg-slate-100 text-slate-700 border-slate-200')}>
                                                  {h.status}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-100 group-hover/log:bg-white group-hover/log:shadow-sm transition-all">
                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{h.note || '---'}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="p-4 bg-slate-50/80 border-t border-slate-100 backdrop-blur-sm">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Rapid Update</Label>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <Input 
                                        placeholder="Write note..." 
                                        className="h-8 text-[11px] bg-white border-slate-200 rounded-xl focus:ring-blue-500 shadow-sm"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                            onUpdate(item.internalId, { note: e.currentTarget.value });
                                            e.currentTarget.value = '';
                                          }
                                        }}
                                      />
                                      <Button 
                                        className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 shrink-0 transform active:scale-95 transition-transform"
                                        onClick={(e) => {
                                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                          if (input.value.trim()) {
                                            onUpdate(item.internalId, { note: input.value });
                                            input.value = '';
                                          }
                                        }}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.includes('note') && (
                        <TableCell style={{ width: columnWidths['note'], minWidth: columnWidths['note'], maxWidth: columnWidths['note'] }} className="p-0 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden relative group/note">
                          <EditableNoteTextarea
                            value={item.note}
                            onSave={(val) => onUpdate(item.internalId, { note: val })}
                            className={cn(
                              "min-h-[30px] h-10 py-1 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent hover:bg-white focus:bg-white text-[9px] font-semibold capitalize rounded-lg resize-none overflow-hidden hover:overflow-y-auto transition-all shadow-none px-2 leading-tight w-full"
                            )}
                            placeholder="Add note..."
                          />
                        </TableCell>
                      )}
                      {visibleColumns.includes('raiderCall') && (
                        <TableCell style={{ width: columnWidths['raiderCall'], minWidth: columnWidths['raiderCall'], maxWidth: columnWidths['raiderCall'] }} className="p-0 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden">
                          <Select
                            value={item.raiderCall || ''}
                            onValueChange={(v: CallStatus | '') => onUpdate(item.internalId, { raiderCall: v })}
                          >
                            <SelectTrigger className={cn(
                              "h-7 w-full border-transparent hover:border-slate-200 transition-all font-black px-1.5 mx-1 rounded-lg bg-transparent hover:bg-white focus:bg-white text-[8px] capitalize tracking-tighter shadow-none",
                              item.raiderCall && CALL_STATUS_COLORS[item.raiderCall as CallStatus]
                            )}>
                              <SelectValue placeholder="---" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                              <SelectItem value="" className="text-[9px] font-black capitalize">None</SelectItem>
                              {ALL_CALL_STATUSES.map((status) => (
                                <SelectItem key={status} value={status} className="text-[9px] font-black capitalize tracking-tighter">
                                  <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black capitalize", CALL_STATUS_COLORS[status])}>
                                    {status}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      {visibleColumns.includes('raiderNote') && (
                        <TableCell style={{ width: columnWidths['raiderNote'], minWidth: columnWidths['raiderNote'], maxWidth: columnWidths['raiderNote'] }} className="p-0 border-r border-slate-200 flex items-center grow-0 shrink-0 h-14 overflow-hidden relative">
                          <EditableNoteTextarea
                            value={item.raiderNote}
                            onSave={(val) => onUpdate(item.internalId, { raiderNote: val })}
                            className={cn(
                              "min-h-[30px] h-8 py-1 border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent hover:bg-white focus:bg-white text-[9px] font-semibold capitalize rounded-lg resize-none overflow-hidden hover:overflow-y-auto transition-all shadow-none px-2 leading-tight w-full"
                            )}
                            placeholder="Raider Note..."
                          />
                        </TableCell>
                      )}
                      <TableCell className="w-[120px] min-w-[120px] max-w-[120px] text-right whitespace-nowrap px-4 h-14 flex items-center justify-end sticky right-0 z-10 bg-white group-hover/row:bg-slate-50 transition-colors shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-200">
                        <div className="flex justify-end items-center gap-1.5">
                          {item.status && LOCKED_STATUSES.includes(item.status as Status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7 rounded-lg transition-all",
                                unlockedIds.includes(item.internalId) 
                                  ? "text-blue-600 bg-blue-50 ring-1 ring-blue-100" 
                                  : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                              )}
                              onClick={() => toggleLock(item.internalId)}
                            >
                              {unlockedIds.includes(item.internalId) ? <LockKeyholeOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            </Button>
                          )}
                          
                          {!isLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7 rounded-lg transition-all",
                                "text-slate-400 hover:text-blue-600 hover:bg-blue-50",
                                syncingId === item.internalId && "animate-spin text-blue-600",
                                !(item.consignmentId || item.orderId) && "opacity-10 cursor-not-allowed"
                              )}
                              onClick={() => handleSync(item.internalId, item)}
                              disabled={syncingId === item.internalId || !(item.consignmentId || item.orderId)}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger nativeButton={true} render={
                              <button
                                className={cn(buttonVariants({ variant: "ghost", size: "icon", className: "h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" }))}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            } />
                            <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-none shadow-2xl rounded-3xl p-8 max-w-sm fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] outline-none">
                              <AlertDialogHeader>
                                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                  <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <AlertDialogTitle className="text-xl font-black tracking-tight text-center">Delete record?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed text-center text-xs">
                                  IRREVERSIBLE: <span className="font-black text-slate-900">{item.orderId || item.consignmentId}</span> will be purged.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-6 gap-3">
                                <AlertDialogCancel className="rounded-xl border-slate-200 h-9 text-[10px] uppercase font-black tracking-widest flex-1">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => onDelete(item.internalId)}
                                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-9 text-[10px] uppercase font-black tracking-widest flex-1"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        
        {/* Mobile View - More Compact */}
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedData.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No entries found.</div>
          ) : (
            paginatedData.map((item) => {
              const isSelected = selectedIds.includes(item.internalId);
              const isLocked = item.status && LOCKED_STATUSES.includes(item.status as Status) && !unlockedIds.includes(item.internalId);
              return (
                <div 
                  key={item.internalId} 
                  className={cn(
                    "p-3 space-y-2.5 transition-colors",
                    isSelected && "bg-blue-50/20"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Checkbox 
                        checked={isSelected}
                        className="h-3.5 w-3.5"
                        onCheckedChange={() => toggleSelect(item.internalId)}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-1 group/mob-id">
                          <span className="text-[10px] font-black text-slate-900 truncate">{item.orderId || '---'}</span>
                          {item.orderId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(item.orderId, `${item.internalId}-mob-order`)}
                              className={cn(
                                "h-4 w-4 opacity-40",
                                copiedId === `${item.internalId}-mob-order` && "text-emerald-500"
                              )}
                            >
                              {copiedId === `${item.internalId}-mob-order` ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 group/mob-con">
                          <span className="text-[8px] font-mono font-bold text-slate-400 truncate">{item.consignmentId || '---'}</span>
                          {item.consignmentId && (
                            <div className="flex items-center gap-2 ml-1">
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  const url = `https://merchant.pathao.com/tracking?consignment_id=${item.consignmentId}&phone=${item.phone || ''}`;
                                  const w = 560;
                                  const h = 850;
                                  const left = (window.screen.width / 2) - (w / 2);
                                  const top = (window.screen.height / 2) - (h / 2);
                                  window.open(url, 'PathaoTracking', `width=${w},height=${h},top=${top},left=${left},scrollbars=yes,resizable=yes`);
                                }}
                                className="h-6 w-6 flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-sm cursor-pointer"
                                title="Track on Pathao"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {item.phone && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded truncate">{item.phone}</span>
                            <a 
                              href={`tel:${item.phone}`}
                              className="h-6 w-6 flex items-center justify-center bg-emerald-500 text-white rounded-lg shadow-sm"
                              title="Call now"
                            >
                              <PhoneCall className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {item.status && LOCKED_STATUSES.includes(item.status as Status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 rounded-lg",
                            unlockedIds.includes(item.internalId) 
                              ? "text-blue-600 bg-blue-50" 
                              : "text-slate-400 hover:text-amber-600"
                          )}
                          onClick={() => toggleLock(item.internalId)}
                        >
                          {unlockedIds.includes(item.internalId) ? <LockKeyholeOpen className="h-3 h-3" /> : <Lock className="h-3 w-3" />}
                        </Button>
                      )}
                      
                      {!isLocked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600",
                            syncingId === item.internalId && "animate-spin text-blue-600"
                          )}
                          onClick={() => handleSync(item.internalId, item)}
                          disabled={syncingId === item.internalId}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      <Popover>
                        <PopoverTrigger nativeButton={true} render={
                          <button 
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon", className: "h-7 w-7 rounded-lg" }),
                              (item.history?.length || 0) > 0 ? "text-amber-600 bg-amber-50" : "text-slate-400"
                            )}
                          >
                            <History className="h-3 w-3" />
                          </button>
                        } />
                        <PopoverContent className="w-[calc(100vw-32px)] max-w-sm p-0 bg-white" align="end">
                          {/* ... Popover content stays similar but scaled down if needed ... */}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Priority</label>
                      <Select
                        value={item.priority || ''}
                        onValueChange={(v: Priority | '') => onUpdate(item.internalId, { priority: v })}
                      >
                        <SelectTrigger className={cn("h-7 w-full text-[9px] font-black uppercase tracking-tighter", item.priority && PRIORITY_COLORS[item.priority as Priority])}>
                          <SelectValue placeholder="---" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[220px]">
                          <SelectItem value="" className="text-xs">None</SelectItem>
                          <SelectItem value="High" className="text-xs">High</SelectItem>
                          <SelectItem value="Medium" className="text-xs">Medium</SelectItem>
                          <SelectItem value="Low" className="text-xs">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Status</label>
                      <Select
                        value={item.status || ''}
                        onValueChange={(v: Status | '') => onUpdate(item.internalId, { status: v })}
                        disabled={isLocked as boolean}
                      >
                        <SelectTrigger className={cn(
                          "h-7 w-full text-[8px] font-black uppercase tracking-wider", 
                          item.status && STATUS_COLORS[item.status as Status],
                          isLocked && "opacity-80 grayscale-[0.2]"
                        )}>
                          <div className="flex items-center gap-1 truncate">
                            {isLocked && <Lock className="h-2.5 w-2.5 text-slate-500/50" />}
                            <SelectValue placeholder="---" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-h-[220px]">
                          <SelectItem value="" className="text-xs">None</SelectItem>
                          {ALL_STATUSES.map((status) => (
                            <SelectItem key={status} value={status} className="text-xs uppercase font-bold tracking-tight">
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Date</label>
                      <Popover>
                        <PopoverTrigger nativeButton={true} render={
                          <button className={cn(buttonVariants({ variant: "outline", className: "h-7 w-full text-[9px] font-black justify-start px-2 border-slate-200" }))}>
                            {safeFormat(item.date, "dd MMM")}
                          </button>
                        } />
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={item.date ? parseISO(item.date) : undefined}
                            onSelect={(date) => date && onUpdate(item.internalId, { date: date.toISOString() })}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Call</label>
                      <Select
                        value={item.call || ''}
                        onValueChange={(v: CallStatus | '') => onUpdate(item.internalId, { call: v })}
                      >
                        <SelectTrigger className={cn("h-7 w-full text-[9px] font-black uppercase tracking-tighter", item.call && CALL_STATUS_COLORS[item.call as CallStatus])}>
                          <SelectValue placeholder="---" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" className="text-xs">None</SelectItem>
                          {ALL_CALL_STATUSES.map((status) => (
                            <SelectItem key={status} value={status} className="text-xs uppercase font-bold tracking-tight">
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Note (Tap to edit)</label>
                    <Popover>
                      <PopoverTrigger nativeButton={true} render={
                        <button className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-600 italic truncate cursor-pointer hover:bg-slate-100 transition-colors text-left w-full">
                          {item.note || "No note added..."}
                        </button>
                      } />
                      <PopoverContent className="w-[calc(100vw-32px)] max-w-sm p-4 bg-white" align="center">
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Update Note</h4>
                          <EditableNoteTextarea 
                            value={item.note}
                            onSave={(val) => onUpdate(item.internalId, { note: val })}
                            className="min-h-[100px] text-xs"
                            placeholder="Write your note here..."
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        <div className="px-3 py-2 bg-white/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rows:</span>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(parseInt(v))}>
                <SelectTrigger className="h-7 w-[70px] bg-white border-slate-200 text-[10px] rounded-lg shadow-sm font-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 rounded-xl shadow-xl">
                  {['5', '10', '25', '50', '100', '250', '500', '1000'].map(v => (
                    <SelectItem key={v} value={v} className="text-[10px] font-black">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest whitespace-nowrap">
              Showing <span className="text-slate-900">{totalItems > 0 ? startIndex + 1 : 0}</span>-
              <span className="text-slate-900">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of 
              <span className="text-slate-900 ml-1">{totalItems}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 rounded-lg border-slate-200 text-slate-600 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all font-black text-[9px] uppercase tracking-wider disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
                <span className="hidden sm:inline">Prev</span>
              </Button>

              <div className="flex items-center gap-0.5">
                {(() => {
                  const pages = [];
                  const maxVisible = 3;
                  let startPage = Math.max(1, currentPage - 1);
                  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                  
                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button
                        key={i}
                        variant={currentPage === i ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-7 w-7 rounded-lg text-[10px] font-black transition-all",
                          currentPage === i ? "bg-blue-600 text-white shadow-md" : "hover:bg-slate-100 text-slate-600"
                        )}
                        onClick={() => setCurrentPage(i)}
                      >
                        {i}
                      </Button>
                    );
                  }
                  return pages;
                })()}
                {totalPages > 3 && currentPage < totalPages - 1 && (
                  <span className="px-1 text-slate-300">...</span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1 rounded-lg border-slate-200 text-slate-600 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all font-black text-[9px] uppercase tracking-wider disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-lg border-slate-200 text-slate-500 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First Page"
              >
                <ChevronsLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-lg border-slate-200 text-slate-500 hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                title="Last Page"
              >
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>      {/* Bulk Sync Summary Dialog */}
      <AlertDialog open={showBulkSyncSummary} onOpenChange={setShowBulkSyncSummary}>
        <AlertDialogContent className="max-w-[500px] w-[calc(100vw-32px)] max-h-[90vh] bg-white border-none shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] rounded-[3rem] overflow-hidden p-0 gap-0 outline-none ring-0 fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
          {/* Top Bar */}
          <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
            <span className="text-sm font-bold text-slate-400">Recent</span>
            <button 
              onClick={() => setShowBulkSyncSummary(false)}
              className="text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors"
            >
              Clear all
            </button>
          </div>
          
          <div className="px-6 pb-6 flex flex-col min-h-0 overflow-hidden">
            <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar scroll-smooth">
              <AnimatePresence mode="popLayout">
                {bulkSyncResults.length === 0 && isBulkSyncingSelected && (
                  <div className="py-20 flex flex-col items-center justify-center gap-6">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center border border-slate-100 shadow-sm"
                    >
                      <RefreshCw className="h-8 w-8 text-indigo-500" />
                    </motion.div>
                    <div className="text-center space-y-1">
                      <span className="text-base font-bold text-slate-900 block tracking-tight">Syncing features...</span>
                      <span className="text-xs text-slate-400 font-medium">Updating your local board state.</span>
                    </div>
                  </div>
                )}

                {bulkSyncResults.length === 0 && !isBulkSyncingSelected && (
                  <div className="py-16 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center border border-slate-100">
                       <PackageOpen className="h-8 w-8 text-slate-300" />
                    </div>
                    <div className="text-center space-y-1">
                      <span className="text-sm font-bold text-slate-900 block tracking-tight">No updates detected</span>
                      <span className="text-xs text-slate-400 font-medium">Your data is already synchronized.</span>
                    </div>
                  </div>
                )}

                {bulkSyncResults.map((result, idx) => (
                  <motion.div 
                    key={`${result.orderId}-${idx}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "group flex items-center gap-5 p-4 rounded-[2rem] transition-all duration-200 hover:bg-slate-50/80",
                      !result.success && "bg-rose-50/30"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-sm border border-white/50",
                      result.success ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                    )}>
                      {result.success ? (
                        <div className="bg-indigo-500/10 p-2 rounded-xl">
                          <RefreshCw className={cn("h-6 w-6 text-indigo-600", isBulkSyncingSelected && "animate-spin")} />
                        </div>
                      ) : (
                        <div className="bg-rose-500/10 p-2 rounded-xl">
                          <AlertCircle className="h-6 w-6 text-rose-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-bold text-slate-900 tracking-tight truncate">{result.orderId}</h4>
                      <p className="text-[13px] font-medium text-slate-500 tracking-tight truncate opacity-80">
                        {result.previousStatus} → {result.status}
                      </p>
                    </div>
                    
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="p-2 bg-slate-100 rounded-full hover:bg-rose-100 transition-colors group/trash">
                          <Trash2 className="h-4 w-4 text-slate-400 group-hover/trash:text-rose-500" />
                       </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Chips */}
          <div className="px-8 pb-10 flex flex-wrap gap-3 shrink-0">
             {/* Total Pill */}
             <div className="bg-orange-100/50 rounded-full pl-1.5 pr-5 py-1.5 flex items-center gap-2.5 border border-orange-200/50 shadow-sm">
                <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-[12px] font-black text-orange-600 shadow-sm ring-1 ring-orange-100">
                  {bulkSyncResults.length}
                </div>
                <span className="text-[13px] font-bold text-orange-700 tracking-tight">Total</span>
                <X className="h-3.5 w-3.5 text-orange-400/60 ml-0.5" />
             </div>

             {Object.entries(
                bulkSyncResults.reduce((acc, curr) => {
                  if (!curr.success) return acc;
                  const key = curr.status;
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count], idx) => {
                const colors = [
                  { bg: 'bg-amber-100/50', border: 'border-amber-200/50', text: 'text-amber-700', icon: 'text-amber-400/60' },
                  { bg: 'bg-purple-100/50', border: 'border-purple-200/50', text: 'text-purple-700', icon: 'text-purple-400/60' },
                  { bg: 'bg-emerald-100/50', border: 'border-emerald-200/50', text: 'text-emerald-700', icon: 'text-emerald-400/60' },
                ];
                const color = colors[idx % colors.length];
                
                return (
                  <div key={status} className={cn(color.bg, "rounded-full pl-1.5 pr-5 py-1.5 flex items-center gap-2.5 border shadow-sm", color.border)}>
                    <div className={cn("w-7 h-7 bg-white rounded-full flex items-center justify-center text-[12px] font-black shadow-sm ring-1", color.text, color.border.replace('border-', 'ring-'))}>
                      {count}
                    </div>
                    <span className={cn("text-[13px] font-bold tracking-tight", color.text)}>{status}</span>
                    <X className={cn("h-3.5 w-3.5 ml-0.5", color.icon)} />
                  </div>
                );
              })}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
