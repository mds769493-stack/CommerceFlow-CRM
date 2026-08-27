import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  productName: string;
}

export function ImageLightbox({ isOpen, onClose, imageUrl, productName }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/90 backdrop-blur-md cursor-zoom-out"
        />

        {/* Controls Bar */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 p-2 rounded-2xl z-10"
        >
          <div className="flex items-center gap-1 px-2 border-r border-white/10 mr-1">
            <span className="text-white text-xs font-bold truncate max-w-[150px] md:max-w-[300px]">
              {productName}
            </span>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-9 w-9 text-white hover:bg-white/20 rounded-xl"
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <div className="text-white text-[10px] font-mono w-10 text-center font-bold">
            {Math.round(scale * 100)}%
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-9 w-9 text-white hover:bg-white/20 rounded-xl"
            disabled={scale >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="h-9 w-9 text-white hover:bg-white/20 rounded-xl"
            title="Reset Zoom"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 bg-white/20 text-white hover:bg-rose-500 rounded-xl transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>

        {/* Image Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full h-full flex items-center justify-center pointer-events-none"
        >
          <motion.img
            src={imageUrl}
            alt={productName}
            className="max-w-full max-h-full object-contain pointer-events-auto cursor-grab active:cursor-grabbing shadow-2xl rounded-lg"
            style={{ 
              scale,
              x: position.x,
              y: position.y
            }}
            drag={scale > 1}
            dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* Mobile Info Tooltip */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 md:hidden">
          <p className="text-white/40 text-[10px] font-medium tracking-widest uppercase bg-black/20 backdrop-blur px-4 py-2 rounded-full">
            Pinch or Drag to Zoom
          </p>
        </div>
      </div>
    </AnimatePresence>
  );
}
