'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useAppStore, Bin } from '@/store/app-store';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/useWebSocket';

// Import components
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import Dashboard from '@/components/dashboard/Dashboard';
import BinDetailModal from '@/components/modals/BinDetailModal';
import AddBinModal from '@/components/modals/AddBinModal';
import NavigationPanel from '@/components/NavigationPanel';

// Dynamic import for map to avoid SSR issues
const MapView = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-500">กำลังโหลดแผนที่...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const {
    bins,
    setBins,
    selectedBin,
    setSelectedBin,
    viewMode,
    isLoading,
    setIsLoading,
    userLocation,
    setUserLocation,
    setMapCenter,
    isAddingBin,
    setIsAddingBin,
    newBinLocation,
    setNewBinLocation,
    addBin,
  } = useAppStore();

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddBinModalOpen, setIsAddBinModalOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastAddressRef = useRef<string>('');
  const addressFetchTimeRef = useRef<number>(0);

  // WebSocket for real-time updates from server
  useWebSocket();

  // Fetch bins (with optional silent mode)
  const fetchBins = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      const response = await fetch('/api/bins');
      const data = await response.json();
      if (data.success) {
        setBins(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch bins:', error);
      if (!silent) {
        toast.error('ไม่สามารถโหลดข้อมูลถังขยะได้');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [setBins, setIsLoading]);

  // Function to get address from coordinates via our API (with throttling)
  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
    // Only fetch address every 30 seconds max
    const now = Date.now();
    if (now - addressFetchTimeRef.current < 30000) {
      return lastAddressRef.current || 'ไม่ทราบที่อยู่';
    }

    try {
      addressFetchTimeRef.current = now;
      const response = await fetch(`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`);
      const data = await response.json();
      if (data.success && data.data?.address) {
        lastAddressRef.current = data.data.address;
        return data.data.address;
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
    return lastAddressRef.current || 'ไม่ทราบที่อยู่';
  };

  // Start continuous location tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      setHasInitialized(true);
      return;
    }

    console.log('Starting continuous location tracking...');

    // Watch position continuously with high accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading, speed, accuracy } = position.coords;

        console.log('Location update:', { latitude, longitude, heading, accuracy });

        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude)) return;

        // Get address (throttled internally)
        const address = await getAddressFromCoords(latitude, longitude);

        const newLocation = {
          latitude,
          longitude,
          address,
          heading: heading ?? userLocation?.heading ?? 0,
        };

        setUserLocation(newLocation);

        // Update map center on first location
        if (!hasInitialized) {
          setMapCenter([latitude, longitude]);
          setHasInitialized(true);
          console.log('Map centered on user location');
        }
      },
      (error) => {
        console.log('Location tracking error:', error.code, error.message);
        if (!hasInitialized) {
          setHasInitialized(true);
        }
        // Show error only for permission denied
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('ไม่สามารถเข้าถึงตำแหน่งของคุณ กรุณาอนุญาตให้เว็บเข้าถึงตำแหน่ง');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0, // Always get fresh position
      }
    );

    // Cleanup on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log('Location tracking stopped');
      }
    };
  }, []); // Run once on mount

  // Fetch bins on mount (initial load only, then WebSocket handles updates)
  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  // Re-fetch bins when switching to map view
  useEffect(() => {
    if (hasInitialized && viewMode === 'map') {
      fetchBins();
    }
  }, [hasInitialized, viewMode, fetchBins]);

  // Watch for newBinLocation changes and open modal
  useEffect(() => {
    if (newBinLocation && isAddingBin) {
      setIsAddBinModalOpen(true);
    }
  }, [newBinLocation, isAddingBin]);

  // Handle bin selection
  const handleBinSelect = (bin: Bin) => {
    setSelectedBin(bin);
    setIsDetailOpen(true);
  };

  // Handle add bin
  const handleAddBin = async (data: {
    name: string;
    address: string;
    district?: string;
    subDistrict?: string;
    province?: string;
    municipality?: string;
    latitude: number;
    longitude: number;
    capacity?: number;
    maxDistance?: number;
  }) => {
    try {
      const response = await fetch('/api/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (result.success) {
        // Add bin to store
        const newBin: Bin = {
          id: result.data.id,
          apiKey: result.data.apiKey,
          name: result.data.name,
          address: result.data.address,
          district: result.data.district,
          subDistrict: result.data.subDistrict,
          province: result.data.province,
          municipality: result.data.municipality,
          latitude: result.data.latitude,
          longitude: result.data.longitude,
          capacity: result.data.capacity,
          maxDistance: result.data.maxDistance,
          wasteLevel: 0,
          lightLevel: 0,
          lightStatus: false,
          autoLight: true,
          autoStatus: true,
          ledGreen: false,
          ledRed: false,
          temperature: null,
          humidity: null,
          isActive: true,
          lastUpdate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: result.data.createdBy,
          createdByRole: result.data.createdByRole,
        };

        addBin(newBin);
        toast.success(`เพิ่มถังขยะสำเร็จ!`);

        // Exit add bin mode
        setIsAddingBin(false);
        setNewBinLocation(null);
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Failed to add bin:', error);
      toast.error('ไม่สามารถเพิ่มถังขยะได้');
    }
  };

  // Handle delete bin
  const handleDeleteBin = async (bin: Bin) => {
    if (!confirm(`ต้องการลบถังขยะ "${bin.name}" ใช่หรือไม่?`)) return;

    try {
      const response = await fetch(`/api/bins/${bin.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setIsDetailOpen(false);
        setSelectedBin(null);
        fetchBins();
        toast.success('ลบถังขยะสำเร็จ');
      }
    } catch (error) {
      console.error('Failed to delete bin:', error);
      toast.error('ไม่สามารถลบถังขยะได้ หรือคุณไม่มีสิทธิ์ลบถังขยะนี้');
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-gray-100">
      {/* Map or Dashboard View */}
      <AnimatePresence mode="wait">
        {viewMode === 'map' ? (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full relative"
          >
            {/* Map */}
            <MapView onBinSelect={handleBinSelect} />

            {/* Search Bar */}
            <div className="absolute top-20 left-4 right-4 md:right-auto md:w-96 z-20">
              <SearchBar />
            </div>

            {/* Loading Overlay */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/80 flex items-center justify-center z-10"
                >
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent mx-auto mb-4" />
                    <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full overflow-auto bg-gradient-to-br from-gray-50 to-gray-100"
          >
            {/* Header for Dashboard */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b z-10">
              <Header />
            </div>

            {/* Dashboard Content */}
            <Dashboard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header for Map View */}
      {viewMode === 'map' && <Header />}

      {/* Navigation Panel - Shows at bottom when navigating */}
      <NavigationPanel />

      {/* Modals */}
      <BinDetailModal
        bin={selectedBin}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedBin(null);
        }}
        onDelete={handleDeleteBin}
      />

      <AddBinModal
        isOpen={isAddBinModalOpen}
        onClose={() => {
          setIsAddBinModalOpen(false);
          setIsAddingBin(false);
          setNewBinLocation(null);
        }}
        onSubmit={handleAddBin}
      />
    </main>
  );
}
