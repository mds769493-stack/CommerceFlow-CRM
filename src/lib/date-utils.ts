import { format, parseISO, isValid, parse } from 'date-fns';

export function safeFormat(date: any, formatStr: string, fallback: string = '---'): string {
  const dateObj = safeDate(date);
  if (dateObj && isValid(dateObj)) {
    try {
      return format(dateObj, formatStr);
    } catch (error) {
      console.error('format error:', error);
    }
  }
  return fallback;
}

export function safeDate(date: any): Date | undefined {
  if (!date) return undefined;
  
  try {
    // 1. Handle Date object
    if (date instanceof Date) return isValid(date) ? date : undefined;
    
    // 2. Handle number (timestamp)
    if (typeof date === 'number') {
      const d = new Date(date);
      return isValid(d) ? d : undefined;
    }
    
    // 3. Handle Firestore Timestamp
    if (date && typeof date === 'object') {
      if ('seconds' in date && typeof date.toDate === 'function') {
        return date.toDate();
      }
      if ('_seconds' in date) { // Sometimes seen in serialized JSON
        return new Date(date._seconds * 1000);
      }
      if ('seconds' in date && typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000);
      }
    }
    
    // 4. Handle String
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (!trimmed) return undefined;

      // Try ISO first
      const isoParsed = parseISO(trimmed);
      if (isValid(isoParsed) && isoParsed.getFullYear() > 1900) return isoParsed;

      // Try numeric (serial) date - Excel style
      const serialNum = Number(trimmed);
      if (!isNaN(serialNum) && serialNum > 30000 && serialNum < 60000) {
        // Excel serial date 45000 is around 2023
        const d = new Date(Math.round((serialNum - 25569) * 86400 * 1000));
        if (isValid(d)) return d;
      }

      // Try common formats
      const formats = [
        'dd/MM/yyyy',
        'dd.MM.yyyy',
        'dd-MM-yyyy',
        'MM/dd/yyyy',
        'yyyy-MM-dd HH:mm:ss',
        'yyyy-MM-dd',
        'dd MMM yyyy',
        'dd MMM, yyyy',
        'MMM dd, yyyy',
        'dd MMM yy',
        'dd-MM-yy',
        'dd.MM.yy'
      ];

      for (const f of formats) {
        try {
          const p = parse(trimmed, f, new Date());
          if (isValid(p) && p.getFullYear() > 1900) return p;
        } catch (e) {
          // ignore
        }
      }
      
      // Try native JS Date as last resort
      const native = new Date(trimmed);
      if (isValid(native) && native.getFullYear() > 1900) return native;
      
      // Fallback for some strange strings that might be timestamps as strings
      if (!isNaN(serialNum) && serialNum > 1000000000) {
        const d = new Date(serialNum > 9999999999 ? serialNum : serialNum * 1000);
        if (isValid(d)) return d;
      }
    }
  } catch (error) {
    console.error('safeDate error:', error);
  }
  
  return undefined;
}

export function safeParseISO(date: any): Date | undefined {
  return safeDate(date);
}
