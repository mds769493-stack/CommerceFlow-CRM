import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { FollowUpTable } from '../components/FollowUpTable';
import { AddEntryDialog } from '../components/AddEntryDialog';
import { ImportExport } from '../components/ImportExport';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Layers, Archive } from 'lucide-react';

export function FollowUpsPage() {
  const {
    followUps,
    isAutoSyncing,
    activeFollowUpSubTab,
    setActiveFollowUpSubTab,
    followUpCounts,
    addFollowUp,
    updateFollowUp,
    deleteFollowUp,
    deleteMultipleFollowUps,
    updateMultipleFollowUps,
    syncOrderStatus,
    bulkSync,
    bulkImport,
    preFetchRecentOrders,
    statusFilter,
    setStatusFilter,
    isBulkSyncing,
    setIsBulkSyncing
  } = useAppContext();

  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    try {
      await bulkSync();
    } finally {
      setIsBulkSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Sub-tab switcher: Main Board vs History Vault */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setActiveFollowUpSubTab('main')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFollowUpSubTab === 'main'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Active Board
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800">
                {followUpCounts.main}
              </span>
            </button>
            <button
              onClick={() => setActiveFollowUpSubTab('others')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFollowUpSubTab === 'others'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-slate-500" />
              Resolved & Locked
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {followUpCounts.others}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkSync}
            disabled={isBulkSyncing}
            className="h-9 px-3 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isBulkSyncing ? 'animate-spin' : ''}`} />
            {isBulkSyncing ? 'Syncing...' : 'Bulk Sync'}
          </Button>

          <ImportExport
            onImport={bulkImport}
            data={followUps}
          />

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </Button>
        </div>
      </div>

      <FollowUpTable
        followUps={followUps}
        onUpdate={updateFollowUp}
        onUpdateMultiple={updateMultipleFollowUps}
        onDelete={deleteFollowUp}
        onDeleteMultiple={deleteMultipleFollowUps}
        onSync={syncOrderStatus}
        onPreFetchRecentOrders={preFetchRecentOrders}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isAutoSyncing={isAutoSyncing}
        activeTab={activeFollowUpSubTab}
        setActiveTab={setActiveFollowUpSubTab}
      />

      <AddEntryDialog
        isOpen={isAddOpen}
        onOpenChange={setIsAddOpen}
        onAdd={addFollowUp}
        followUps={followUps}
        hideTrigger={true}
      />
    </div>
  );
}
export default FollowUpsPage;
