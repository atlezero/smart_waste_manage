'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MapPin, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Bin, useAppStore } from '@/store/app-store';

interface SearchResult {
  type: 'bin' | 'location';
  bin?: Bin;
  location?: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
}

export default function SearchBar() {
  const { bins, setHighlightedBinId, setMapCenter, setMapZoom, searchQuery, setSearchQuery } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    
    // Search in bins
    const binResults = bins
      .filter(bin => 
        bin.clientId.toLowerCase().includes(query) ||
        bin.name.toLowerCase().includes(query) ||
        bin.address.toLowerCase().includes(query) ||
        bin.district?.toLowerCase().includes(query) ||
        bin.subDistrict?.toLowerCase().includes(query) ||
        bin.province?.toLowerCase().includes(query) ||
        bin.municipality?.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .map(bin => ({
        type: 'bin' as const,
        bin,
      }));

    setResults(binResults);
    setIsOpen(true);
  }, [searchQuery, bins]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    if (result.type === 'bin' && result.bin) {
      setHighlightedBinId(result.bin.id);
      setMapCenter([result.bin.latitude, result.bin.longitude]);
      setMapZoom(16);
    } else if (result.type === 'location' && result.location) {
      setMapCenter([result.location.lat, result.location.lng]);
      setMapZoom(15);
    }
    setIsOpen(false);
    setSearchQuery(result.type === 'bin' && result.bin ? result.bin.name : result.location?.name || '');
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoadingLocation(true);
    try {
      // Use Nominatim for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=3`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const locationResults: SearchResult[] = data.map((item: { display_name: string; lat: string; lon: string }) => ({
          type: 'location' as const,
          location: {
            name: item.display_name.split(',')[0],
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          },
        }));
        
        setResults(prev => [...prev.filter(r => r.type === 'bin'), ...locationResults]);
      }
    } catch (error) {
      console.error('Location search error:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchLocation();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="ค้นหาถังขยะ, ที่อยู่, สถานที่..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchQuery && setIsOpen(true)}
          className="pl-10 pr-10 h-11 bg-white/90 backdrop-blur border-0 shadow-lg rounded-xl"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border overflow-hidden z-50"
          >
            <div className="max-h-80 overflow-y-auto">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.bin?.id || result.location?.lat}`}
                  onClick={() => handleSelectResult(result)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-yellow-50 transition-colors text-left"
                >
                  <div className={`p-2 rounded-lg ${
                    result.type === 'bin' ? 'bg-yellow-100' : 'bg-blue-100'
                  }`}>
                    {result.type === 'bin' ? (
                      <Trash2 className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <MapPin className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {result.type === 'bin' ? result.bin?.name : result.location?.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {result.type === 'bin' 
                        ? `${result.bin?.clientId} • ${result.bin?.address}`
                        : result.location?.address
                      }
                    </p>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Search location button */}
            <div className="border-t p-2">
              <button
                onClick={handleSearchLocation}
                disabled={isLoadingLocation}
                className="w-full p-2 text-sm text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoadingLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังค้นหา...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    ค้นหาสถานที่อื่นๆ
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
