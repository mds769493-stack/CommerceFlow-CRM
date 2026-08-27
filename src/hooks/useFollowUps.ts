import { useState, useEffect, useCallback, useRef } from 'react';
import { FollowUp, Status, LOCKED_STATUSES, StatusLog } from '../types';
import { fetchFromApi, saveToApi, deleteFromApi, batchSaveToApi, batchDeleteFromApi, getApiUrl } from '../lib/api';
import { handleFirestoreError } from '../lib/firebase';
import { User } from 'firebase/auth';

interface UseFollowUpsOptions {
  enabled?: boolean;
}

export function useFollowUps(user: User | null, options: UseFollowUpsOptions = {}) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const followUpsRef = useRef<FollowUp[]>([]);

  // Synchronize followUpsRef with state
  useEffect(() => {
    followUpsRef.current = followUps;
  }, [followUps]);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enabled = true } = options;
  const lastAutoSyncRef = useRef<number>(0);
  const recentOrdersCacheRef = useRef<{ data: any[]; timestamp: number } | null>(null);

  const preFetchRecentOrders = useCallback(async (force = false) => {
    const now = Date.now();
    // Cache is valid for 1 minute
    if (!force && recentOrdersCacheRef.current && (now - recentOrdersCacheRef.current.timestamp < 60000)) {
      return recentOrdersCacheRef.current.data;
    }

    console.log("[useFollowUps] Pre-fetching recent orders list from Pathao to accelerate sync...");
    let allFetchedOrders: any[] = [];
    const pagesToFetch = 3;
    const limit = 50;

    for (let page = 1; page <= pagesToFetch; page++) {
      try {
        const response = await fetch(getApiUrl(`/api/pathao-orders?page=${page}&limit=${limit}`));
        if (!response.ok) {
          console.warn(`[PreFetch] Failed to fetch Pathao order list page ${page}: status ${response.status}`);
          break;
        }
        
        const result = await response.json();
        if (result.type === 'success' && result.data) {
          const ordersArray = Array.isArray(result.data) 
            ? result.data 
            : (result.data && Array.isArray(result.data.data) ? result.data.data : []);
            
          if (ordersArray.length === 0) {
            break; 
          }
          
          allFetchedOrders = [...allFetchedOrders, ...ordersArray];
          if (ordersArray.length < limit) {
            break;
          }
        } else {
          break;
        }
      } catch (err) {
        console.error(`[PreFetch] Error fetching page ${page}:`, err);
        break;
      }
    }

    console.log(`[PreFetch] Cached ${allFetchedOrders.length} recent orders from Pathao.`);
    recentOrdersCacheRef.current = {
      data: allFetchedOrders,
      timestamp: now
    };
    return allFetchedOrders;
  }, [user]);

  const fetchFollowUps = useCallback(async (isManualRefresh = false) => {
    if (!user || !enabled) {
      if (!enabled) setIsLoaded(true);
      return;
    }

    setIsFetching(true);
    try {
      const [followUpsData, logsData] = await Promise.all([
        fetchFromApi('followUps'),
        fetchFromApi('statusLogs').catch(() => [])
      ]);

      let entries = (followUpsData as any[]).map(item => ({
        ...item,
        id: item.internalId || item.id,
        internalId: item.internalId || item.id
      })) as FollowUp[];
      
      entries.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
      
      setFollowUps(entries);

      const logs = (logsData as StatusLog[]).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setStatusLogs(logs);

      setIsLoaded(true);
      setError(null);
    } catch (error: any) {
      console.error("Fetch Error (FollowUps):", error);
      setError(error.message);
      setIsLoaded(true);
    } finally {
      setIsFetching(false);
    }
  }, [user, enabled]);

  useEffect(() => {
    fetchFollowUps(false);
  }, [fetchFollowUps]);

  // AUTO SYNC EFFECT
  useEffect(() => {
    if (!user || !isLoaded || isAutoSyncing) return;

    // Request Notification Permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const AUTO_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
    
    const runAutoSync = async () => {
      const now = Date.now();
      if (now - lastAutoSyncRef.current < AUTO_SYNC_INTERVAL) return;
      
      console.log("[AutoSync] Starting background sync...");
      setIsAutoSyncing(true);
      lastAutoSyncRef.current = now;
      
      try {
        await bulkSync();
        console.log("[AutoSync] Completed successfully.");
      } catch (e) {
        console.error("[AutoSync] Failed:", e);
      } finally {
        setIsAutoSyncing(false);
      }
    };

    const timer = setInterval(runAutoSync, 60000); // Check every minute
    runAutoSync(); // Initial run

    return () => clearInterval(timer);
  }, [user, isLoaded, isAutoSyncing]);

  const addFollowUp = async (data: Omit<FollowUp, 'internalId' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    
    // Safety check for duplicates before processing
    const isDuplicate = !!data.orderId && followUps.some(f => (f.orderId || "").toLowerCase() === (data.orderId || "").toLowerCase());
    const isDuplicateConsignment = !!data.consignmentId && followUps.some(f => (f.consignmentId || "").toLowerCase() === (data.consignmentId || "").toLowerCase());
    
    if (isDuplicate || isDuplicateConsignment) {
      const errorMsg = isDuplicate 
        ? `Error: Order ID "${data.orderId}" ইতিমধ্যে Follow-ups-এ বিদ্যমান। ডুপ্লিকেট এন্ট্রি করা যাবে না।`
        : `Error: Consignment ID "${data.consignmentId}" ইতিমধ্যে Follow-ups-এ বিদ্যমান। ডুপ্লিকেট এন্ট্রি করা যাবে না।`;
      throw new Error(errorMsg);
    }

    const now = new Date().toISOString();
    const id = `fu_${Date.now()}`;
    const newFollowUp: FollowUp = {
      ...data,
      id: id,
      internalId: id,
      userId: user.uid,
      history: [{
        status: data.status,
        call: data.call,
        date: data.date,
        note: data.note,
        updatedAt: now
      }],
      createdAt: now,
      updatedAt: now,
    };
    
    // Optimistic Update: Add to UI state instantly!
    setFollowUps(prev => [newFollowUp, ...prev]);

    try {
      await saveToApi('followUps', newFollowUp);
    } catch (e) {
      console.error("Add optimistic failed, rolling back:", e);
      // Rollback optimistic state
      setFollowUps(prev => prev.filter(f => f.internalId !== id));
      handleFirestoreError(e, 'create', 'followUps');
    }
  };

  const cleanId = (s: string | undefined | null) => (s || "").trim().toLowerCase();

  const updateFollowUp = async (internalId: string, updates: Partial<FollowUp>, skipFetch = false) => {
    if (!user) return;

    const now = new Date().toISOString();
    const currentList = followUpsRef.current;
    const targetClean = cleanId(internalId);
    
    let existing = currentList.find(f => 
      cleanId(f.internalId) === targetClean || 
      cleanId(f.id) === targetClean ||
      (f.orderId && cleanId(f.orderId) === targetClean) ||
      (f.consignmentId && cleanId(f.consignmentId) === targetClean)
    );

    if (!existing) {
      // Auto-create item if not found in state, so no warnings or data loss occur
      const newId = `fu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newFollowUp: FollowUp = {
        id: newId,
        internalId: newId,
        userId: user.uid,
        orderId: updates.orderId || internalId,
        consignmentId: updates.consignmentId || '',
        phone: updates.phone || '',
        product: updates.product || '',
        total: updates.total || 0,
        status: updates.status || 'Pending',
        priority: updates.priority || '',
        call: updates.call || '',
        callCount: updates.callCount || 0,
        raiderCall: updates.raiderCall || '',
        raiderNote: updates.raiderNote || '',
        note: updates.note || '',
        date: updates.date || now,
        history: updates.note ? [{
          status: updates.status || 'Pending',
          call: updates.call || '',
          date: updates.date || now,
          note: updates.note,
          updatedAt: now
        }] : [],
        createdAt: now,
        updatedAt: now,
        ...updates
      };

      const updatedList = [newFollowUp, ...currentList];
      followUpsRef.current = updatedList;
      setFollowUps(updatedList);

      try {
        await saveToApi('followUps', newFollowUp);
      } catch (e) {
        console.error("Add followUp failed, rolling back:", e);
        followUpsRef.current = currentList;
        setFollowUps(currentList);
        handleFirestoreError(e, 'create', 'followUps');
      }
      return;
    }

    const targetId = existing.internalId || existing.id || internalId;

    const updated: FollowUp = {
      ...existing,
      ...updates,
      id: targetId,
      internalId: targetId,
      updatedAt: now,
    };

    // Only track history if a note is provided AND it actually changed
    if (updates.note !== undefined && updates.note.trim() !== '' && updates.note !== existing.note) {
      updated.history = [
        ...(existing.history || []),
        {
          status: updates.status ?? existing.status ?? '',
          call: updates.call ?? existing.call ?? '',
          date: updates.date ?? existing.date ?? '',
          note: updates.note,
          updatedAt: now
        }
      ];
      updated.callCount = (existing.callCount || 0) + 1;
    }

    // Update ref immediately so consecutive edits build upon this updated state
    const updatedList = currentList.map(f => 
      (f.internalId === targetId || f.id === targetId || cleanId(f.internalId) === cleanId(targetId) || cleanId(f.id) === cleanId(targetId)) ? updated : f
    );
    followUpsRef.current = updatedList;

    // Optimistically update React state
    setFollowUps(updatedList);

    // Save to Firestore database/API
    try {
      await saveToApi('followUps', updated);
    } catch (e) {
      console.error("Update failed, rolling back:", e);
      // Rollback ref and UI state
      followUpsRef.current = currentList;
      setFollowUps(currentList);
      handleFirestoreError(e, 'update', `followUps/${targetId}`);
    }
  };

  const deleteFollowUp = async (internalId: string) => {
    if (!user) return;
    
    const targetClean = cleanId(internalId);
    const currentList = followUpsRef.current;
    const existing = currentList.find(f => 
      cleanId(f.internalId) === targetClean || 
      cleanId(f.id) === targetClean ||
      (f.orderId && cleanId(f.orderId) === targetClean) ||
      (f.consignmentId && cleanId(f.consignmentId) === targetClean)
    );
    if (!existing) return;

    const targetId = existing.internalId || existing.id || internalId;

    // Optimistic Update: Remove from UI state instantly!
    const updatedList = currentList.filter(f => f.internalId !== targetId && f.id !== targetId && cleanId(f.internalId) !== cleanId(targetId) && cleanId(f.id) !== cleanId(targetId));
    followUpsRef.current = updatedList;
    setFollowUps(updatedList);

    try {
      await deleteFromApi('followUps', targetId);
    } catch (e: any) {
      console.error("Delete optimistic failed, rolling back:", e);
      // Rollback optimistic state
      followUpsRef.current = currentList;
      setFollowUps(currentList);
      setError(`Delete Failed: ${e.message || String(e)}`);
    }
  };

  const deleteMultipleFollowUps = async (internalIds: string[]) => {
    if (!user || internalIds.length === 0) return;
    const currentList = followUpsRef.current;
    const targetCleans = internalIds.map(cleanId);

    const existingItems = currentList.filter(f => 
      targetCleans.includes(cleanId(f.internalId)) || 
      targetCleans.includes(cleanId(f.id)) ||
      (f.orderId && targetCleans.includes(cleanId(f.orderId))) ||
      (f.consignmentId && targetCleans.includes(cleanId(f.consignmentId)))
    );
    const targetIds = existingItems.map(f => f.internalId || f.id).filter(Boolean);

    // Optimistic Update: Remove from UI state instantly!
    const updatedList = currentList.filter(f => !targetIds.includes(f.internalId) && !targetIds.includes(f.id));
    followUpsRef.current = updatedList;
    setFollowUps(updatedList);

    try {
      await batchDeleteFromApi('followUps', targetIds);
    } catch (e: any) {
      console.error("Bulk delete optimistic failed, rolling back:", e);
      // Rollback optimistic state
      followUpsRef.current = currentList;
      setFollowUps(currentList);
      setError(`Bulk Delete Failed: ${e.message || String(e)}`);
    }
  };

  const updateMultipleFollowUps = async (internalIds: string[], updates: Partial<FollowUp>, skipFetch = false) => {
    if (!user || internalIds.length === 0) return;
    const now = new Date().toISOString();
    
    // Find matching items from current ref state
    const currentList = followUpsRef.current;
    const itemsToUpdate = currentList.filter(f => 
      internalIds.includes(f.internalId) || 
      internalIds.includes(f.id) ||
      (f.orderId && internalIds.includes(f.orderId)) ||
      (f.consignmentId && internalIds.includes(f.consignmentId))
    );
    if (itemsToUpdate.length === 0) return;

    const updatedItems = itemsToUpdate.map(existing => {
      const targetId = existing.internalId || existing.id;
      const itemUpdated: FollowUp = {
        ...existing,
        ...updates,
        id: targetId,
        internalId: targetId,
        updatedAt: now
      };

      if (updates.note !== undefined && updates.note.trim() !== '' && updates.note !== existing.note) {
        itemUpdated.history = [
          ...(existing.history || []),
          {
            status: updates.status ?? existing.status ?? '',
            call: updates.call ?? existing.call ?? '',
            date: updates.date ?? existing.date ?? '',
            note: updates.note,
            updatedAt: now
          }
        ];
        itemUpdated.callCount = (existing.callCount || 0) + 1;
      }
      return itemUpdated;
    });

    const updatedList = currentList.map(f => {
      const found = updatedItems.find(it => it.internalId === f.internalId || it.id === f.id);
      return found ? found : f;
    });

    followUpsRef.current = updatedList;
    setFollowUps(updatedList);

    // Save to database
    try {
      await batchSaveToApi('followUps', updatedItems, 'replace');
    } catch (e) {
      console.error("Bulk update failed, rolling back:", e);
      // Rollback UI state
      followUpsRef.current = currentList;
      setFollowUps(currentList);
      handleFirestoreError(e, 'update', 'followUps/multiple');
    }
  };


  const mapPathaoStatus = (pathaoStatus: any): Status => {
    // Safety check: ensure pathaoStatus is a string
    if (!pathaoStatus || typeof pathaoStatus !== 'string') return 'Pending';
    
    // Normalize string: replace underscores and hyphens with spaces, and trim
    const normalized = pathaoStatus.replace(/[_\s-]+/g, ' ').trim().toLowerCase();
    
    // Capitalize every word to make it look professional
    // This ensures that "reattempt_requested" becomes "Reattempt Requested"
    const capitalized = normalized.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // We strictly return what Pathao gives us, formatted for the UI
    return capitalized as Status;
  };

  const syncOrderStatus = async (internalId: string, id: string, type: 'consignment_id' | 'order_id' = 'consignment_id') => {
    try {
      // 1. Try to find match in our pre-fetched cache first!
      if (recentOrdersCacheRef.current && recentOrdersCacheRef.current.data.length > 0) {
        const match = recentOrdersCacheRef.current.data.find(fo => {
          const localConsId = (id || "").toLowerCase().trim();
          const pathaoConsId = (fo.consignment_id || "").toLowerCase().trim();
          const pathaoOrdId = (fo.merchant_order_id || "").toLowerCase().trim();
          return localConsId === pathaoConsId || localConsId === pathaoOrdId;
        });

        if (match) {
          const rawStatus = match.order_status || match.consignment_status || match.status;
          if (rawStatus) {
            const newStatus = mapPathaoStatus(rawStatus);
            console.log(`[Sync] Pre-fetch cache hit for ${id}! Status = "${newStatus}"`);
            
            // Log status change if it's different from current
            const targetClean = cleanId(internalId);
            const existing = followUpsRef.current.find(f => 
              cleanId(f.internalId) === targetClean || 
              cleanId(f.id) === targetClean ||
              (f.orderId && cleanId(f.orderId) === targetClean) ||
              (f.consignmentId && cleanId(f.consignmentId) === targetClean)
            );
            if (existing && existing.status !== newStatus) {
              const log: StatusLog = {
                id: `log_${Date.now()}_${Math.random()}`,
                userId: user!.uid,
                orderId: existing.orderId,
                consignmentId: existing.consignmentId,
                oldStatus: existing.status || 'NONE',
                newStatus: newStatus,
                timestamp: new Date().toISOString()
              };
              
              // Trigger Browser Notification for critical status changes
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                const criticalStatuses = ['Returned', 'Delivered', 'Cancelled'];
                if (criticalStatuses.includes(newStatus)) {
                  new Notification(`Parcel Update: ${newStatus}`, {
                    body: `Order ${existing.orderId} status changed from ${existing.status} to ${newStatus}.`,
                    icon: '/favicon.ico'
                  });
                }
              }
              
              // Save log to API
              saveToApi('statusLogs', log).catch(err => console.error("Failed to save status log:", err));
              
              // Update local status logs state
              setStatusLogs(prev => [log, ...prev]);
            }

            await updateFollowUp(internalId, { status: newStatus }, true);
            return { success: true, status: newStatus };
          }
        }
      }

      // 2. Cache miss, proceed to query single order status with backoff retry for rate limits
      const endpoint = type === 'order_id' 
        ? `/api/order-info-by-order-id/${encodeURIComponent(id)}`
        : `/api/order-info/${encodeURIComponent(id)}`;
        
      let response = await fetch(getApiUrl(endpoint));
      
      // Automatic retry on 429 (Too Many Requests)
      if (response.status === 429) {
        console.warn(`[Sync API] 429 received for ${id}. Retrying after 2.5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2500));
        response = await fetch(getApiUrl(endpoint));
        
        if (response.status === 429) {
          console.warn(`[Sync API] Second 429 received for ${id}. Retrying after 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          response = await fetch(getApiUrl(endpoint));
        }
      }
      
      if (!response.ok) {
        if (response.status === 429) {
          return { success: false, error: "Too Many Requests: Pathao API-তে খুব বেশি রিকোয়েস্ট পাঠানো হয়েছে। দয়া করে ১-২ মিনিট পর আবার চেষ্টা করুন।" };
        }
        
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Server Error (${response.status})`;
        
        if (errorMessage.includes("Pathao API credentials")) {
          return { success: false, error: "Pathao API credentials are missing. Please add PATHAO_CLIENT_ID and PATHAO_CLIENT_SECRET to the secrets panel." };
        }
        
        return { success: false, error: errorMessage };
      }

      const result = await response.json();
      
      if ((result.status === 'ok' || result.type === 'success' || result.data) && result.data) {
        // Result could be a single object or an array (if from search)
        const orderData = Array.isArray(result.data) ? result.data[0] : result.data;
        
        // TELEMETRY: Log full data to see all available status fields
        console.log(`Sync Data Received for ${id}:`, orderData);
        console.log(`Sync Data Keys for ${id}:`, Object.keys(orderData));
        
        // Try known Pathao status field names in order of reliability
        const rawStatus = 
          orderData.order_status || 
          orderData.consignment_status || 
          orderData.status || 
          orderData.order_status_text ||
          orderData.consignment_status_text ||
          (orderData.order && orderData.order.order_status) ||
          (orderData.consignment && orderData.consignment.consignment_status);
        
        if (!rawStatus) {
           console.warn(`No status field found in API response for ${id}. Available keys:`, Object.keys(orderData));
           return { success: false, error: "No status information found in the API response." };
        }

        console.log(`Sync for ${id}: Raw Status from API = "${rawStatus}"`);
        const newStatus = mapPathaoStatus(rawStatus);
        console.log(`Sync for ${id}: Mapped Status = "${newStatus}"`);
        
        // Log status change if it's different from current
        const targetClean = cleanId(internalId);
        const existing = followUpsRef.current.find(f => 
          cleanId(f.internalId) === targetClean || 
          cleanId(f.id) === targetClean ||
          (f.orderId && cleanId(f.orderId) === targetClean) ||
          (f.consignmentId && cleanId(f.consignmentId) === targetClean)
        );
        if (existing && existing.status !== newStatus) {
          const log: StatusLog = {
            id: `log_${Date.now()}_${Math.random()}`,
            userId: user.uid,
            orderId: existing.orderId,
            consignmentId: existing.consignmentId,
            oldStatus: existing.status || 'NONE',
            newStatus: newStatus,
            timestamp: new Date().toISOString()
          };
          
          // Trigger Browser Notification for critical status changes
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const criticalStatuses = ['Returned', 'Delivered', 'Cancelled'];
            if (criticalStatuses.includes(newStatus)) {
              new Notification(`Parcel Update: ${newStatus}`, {
                body: `Order ${existing.orderId} status changed from ${existing.status} to ${newStatus}.`,
                icon: '/favicon.ico'
              });
            }
          }
          
          // Save log to API
          saveToApi('statusLogs', log).catch(err => console.error("Failed to save status log:", err));
          
          // Update local status logs state
          setStatusLogs(prev => [log, ...prev]);
        }

        await updateFollowUp(internalId, { status: newStatus }, true);
        return { success: true, status: newStatus };
      }
      return { success: false, error: result.message || result.error || 'The API returned an unexpected response format.' };
    } catch (error: any) {
      console.error('Handled Sync Error:', error);
      const isNetworkError = error.name === 'TypeError' || error.message?.includes('fetch');
      const msg = isNetworkError 
        ? "Network Error: Could not connect to the backend server. The server might be restarting. Please try again in 5-10 seconds."
        : `Sync Failed: ${error.message || 'Unknown error'}`;
      return { success: false, error: msg };
    }
  };

  const bulkImport = async (newEntries: any[]) => {
    if (!user || newEntries.length === 0) return;
    
    const now = new Date().toISOString();
    
    // Filter out duplicates from the incoming list and against existing followUps
    const existingOrderIds = new Set(followUps.map(f => (f.orderId || "").toLowerCase()));
    const existingConsignmentIds = new Set(followUps.map(f => (f.consignmentId || "").toLowerCase()));
    
    const filteredEntries = newEntries.filter(entry => {
      const orderId = (entry.orderId || "").toLowerCase();
      const consignmentId = (entry.consignmentId || "").toLowerCase();
      
      // If orderId exists, check if it's already in the DB or in the current batch
      if (orderId && existingOrderIds.has(orderId)) return false;
      // If consignmentId exists, check if it's already in the DB or in the current batch
      if (consignmentId && existingConsignmentIds.has(consignmentId)) return false;
      
      if (orderId) existingOrderIds.add(orderId);
      if (consignmentId) existingConsignmentIds.add(consignmentId);
      
      return true;
    });

    if (filteredEntries.length === 0) {
      throw new Error("সকল ডাটাই ইতিমধ্যে বিদ্যমান। কোনো নতুন ডাটা ইম্পোর্ট করা হয়নি।");
    }

    const items: FollowUp[] = filteredEntries.map(entry => {
      const { internalId: _, ...rest } = entry;
      const id = `fu_imp_${Date.now()}_${Math.random()}`;
      return {
        ...rest,
        id: id,
        internalId: id,
        userId: user.uid,
        createdAt: now,
        updatedAt: now,
      } as FollowUp;
    });
    
    // Optimistic Update: Add imported items to the UI state instantly!
    setFollowUps(prev => [...items, ...prev]);

    try {
      await batchSaveToApi('followUps', items, 'replace');
    } catch (e) {
      console.error("Bulk import optimistic failed, rolling back:", e);
      // Rollback
      setFollowUps(prev => prev.filter(f => !items.some(item => item.internalId === f.internalId)));
      handleFirestoreError(e, 'create', 'followUps/bulk');
    }
  };

  const bulkSync = async () => {
    const toSync = followUps.filter(f => {
      const isLocked = f.status && LOCKED_STATUSES.includes(f.status as Status);
      return (f.consignmentId || f.orderId) && !isLocked;
    });
    
    if (toSync.length === 0) return { success: true, count: 0 };

    // Pre-fetch all recent orders from Pathao API once to cache them
    await preFetchRecentOrders(true);

    let successCount = 0;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Batch processing with a concurrency limit and delay to avoid rate limiting
    const batchSize = 2; // Reduced from 6 to 2
    for (let i = 0; i < toSync.length; i += batchSize) {
      const batch = toSync.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (item) => {
          const idToUse = item.consignmentId || item.orderId;
          const syncType = item.consignmentId ? 'consignment_id' : 'order_id';
          try {
            const result = await syncOrderStatus(item.internalId, idToUse, syncType);
            return result.success;
          } catch (e) {
            console.error(`bulkSync error for internalId ${item.internalId}:`, e);
            return false;
          }
        })
      );
      successCount += results.filter(Boolean).length;
      
      // Since cache hits are instantaneous, we only need a tiny pause to allow UI thread breathing room
      if (i + batchSize < toSync.length) {
        await sleep(100); 
      }
    }
    return { success: true, count: successCount };
  };

  return {
    followUps,
    statusLogs,
    isAutoSyncing,
    addFollowUp,
    updateFollowUp,
    updateMultipleFollowUps,
    deleteFollowUp,
    deleteMultipleFollowUps,
    syncOrderStatus,
    bulkSync,
    bulkImport,
    preFetchRecentOrders,
    isLoaded,
    isFetching,
    error,
    refresh: fetchFollowUps
  };
}
