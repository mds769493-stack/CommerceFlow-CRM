import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange
}: PaginationProps) {
  const [jumpPage, setJumpPage] = React.useState(currentPage.toString());

  React.useEffect(() => {
    setJumpPage(currentPage.toString());
  }, [currentPage]);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(jumpPage);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setJumpPage(currentPage.toString());
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 bg-white border-t border-slate-200">
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-500 whitespace-nowrap">
          Total <span className="font-bold text-slate-900">{totalRecords}</span> records
        </p>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 whitespace-nowrap">Rows Per Page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(val) => onPageSizeChange(parseInt(val))}
          >
            <SelectTrigger className="h-8 w-[70px] rounded-lg border-slate-200 bg-slate-50/50">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent>
              {[20, 50, 100, 200, 500].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-6">
        <form onSubmit={handleJump} className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Go To:</span>
          <Input
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            className="h-8 w-14 rounded-lg text-center font-bold border-slate-200 bg-slate-50/50"
          />
          <span className="text-sm text-slate-500">Of {totalPages}</span>
        </form>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-slate-100 disabled:opacity-30"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-slate-100 disabled:opacity-30"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center justify-center min-w-[80px] text-sm font-bold text-slate-900">
            Page {currentPage} Of {totalPages}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-slate-100 disabled:opacity-30"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-slate-100 disabled:opacity-30"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
