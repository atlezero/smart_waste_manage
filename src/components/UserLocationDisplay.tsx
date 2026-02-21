'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';
import { useAppStore } from '@/store/app-store';

export default function UserLocationDisplay() {
  const { userLocation } = useAppStore();
  const [isHidden, setIsHidden] = useState(false);

  if (!userLocation || isHidden) return null;

  // Get short address
  const shortAddress = userLocation.address
    .split(',')
    .slice(0, 3)
    .join(',')
    .trim();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-lg overflow-hidden z-20"
      >
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <MapPin className="w-5 h-5" />
            <span className="font-medium">ตำแหน่งของคุณ</span>
          </div>
          <button
            onClick={() => setIsHidden(true)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="p-3">
          <p className="text-sm text-gray-600 line-clamp-2">{shortAddress}</p>
          <p className="text-xs text-gray-400 mt-1">
            {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
