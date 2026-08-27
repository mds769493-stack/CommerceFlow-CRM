import { io, Socket } from 'socket.io-client';
import { WebOrder } from '../types';

let socket: Socket | null = null;

// Pleasant Web Audio API Synthesizer Chime for new orders (No external MP3 files needed!)
export function playNewOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Harmonic bell sequence: C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1567.98Hz) -> C7 (2093Hz)
    const notes = [
      { freq: 1046.5, start: 0, duration: 0.25 },
      { freq: 1318.5, start: 0.08, duration: 0.25 },
      { freq: 1567.98, start: 0.16, duration: 0.35 },
      { freq: 2093.00, start: 0.26, duration: 0.6 }
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      // Smooth attack & exponential decay
      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.05);
    });
  } catch (e) {
    console.warn('[AUDIO CHIME] Could not play audio chime:', e);
  }
}

// Diagnostic test chime (Short double beep)
export function playTestChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    [
      { freq: 880, start: 0, duration: 0.12 },
      { freq: 1760, start: 0.14, duration: 0.2 }
    ].forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.15, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    });
  } catch (e) {}
}

export function getSocket(): Socket {
  if (!socket) {
    // Connect to current origin
    const url = window.location.origin;
    socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      autoConnect: true
    });

    socket.on('connect', () => {
      console.log('[SOCKET.IO CLIENT] Connected to Real-time Webhook Server ID:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET.IO CLIENT] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[SOCKET.IO CLIENT] Connection error:', err.message);
    });
  }
  return socket;
}

export interface RealtimeOrderPayload {
  order: WebOrder;
  isNew: boolean;
  siteId: string;
  siteName: string;
  timestamp: string;
  soundAlert?: boolean;
}

export function onNewOrderReceived(callback: (payload: RealtimeOrderPayload) => void): () => void {
  const s = getSocket();
  const handler = (data: RealtimeOrderPayload) => {
    if (data?.soundAlert) {
      playNewOrderChime();
    }
    callback(data);
  };
  s.on('woocommerce:new_order', handler);
  s.on('shopify:new_order', handler);
  return () => {
    s.off('woocommerce:new_order', handler);
    s.off('shopify:new_order', handler);
  };
}

export function onOrderUpdatedReceived(callback: (payload: RealtimeOrderPayload) => void): () => void {
  const s = getSocket();
  const handler = (data: RealtimeOrderPayload) => {
    callback(data);
  };
  s.on('woocommerce:order_updated', handler);
  s.on('shopify:order_updated', handler);
  return () => {
    s.off('woocommerce:order_updated', handler);
    s.off('shopify:order_updated', handler);
  };
}

export function onWebhookTestReceived(callback: (data: any) => void): () => void {
  const s = getSocket();
  const handler = (data: any) => {
    playTestChime();
    callback(data);
  };
  s.on('woocommerce:webhook_test_event', handler);
  s.on('shopify:webhook_test_event', handler);
  return () => {
    s.off('woocommerce:webhook_test_event', handler);
    s.off('shopify:webhook_test_event', handler);
  };
}
