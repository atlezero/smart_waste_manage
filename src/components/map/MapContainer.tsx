'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bin, MapTheme, useAppStore, BinFilter } from '@/store/app-store';
import { Filter, AlertTriangle } from 'lucide-react';

// Check if bin is offline (no update for more than 1 hour)
function isBinOffline(bin: Bin): boolean {
  if (!bin.lastUpdate) return true;
  const lastUpdate = new Date(bin.lastUpdate).getTime();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  return (now - lastUpdate) > oneHour;
}

// Check if bin has no sensor data
function hasNoSensorData(bin: Bin): boolean {
  return bin.wasteLevel === 0 && bin.lightLevel === 0;
}

// Check if bin should show warning
function shouldShowWarning(bin: Bin): boolean {
  return hasNoSensorData(bin) || isBinOffline(bin);
}

// Get gradient color from green to yellow to red based on waste level
const getGradientColor = (level: number): string => {
  // 0% = green (#22c55e), 50% = yellow (#f59e0b), 100% = red (#ef4444)
  const clampedLevel = Math.max(0, Math.min(100, level));
  
  let r: number, g: number, b: number;
  
  if (clampedLevel <= 50) {
    // Green to Yellow (0% to 50%)
    const t = clampedLevel / 50;
    // Green: rgb(34, 197, 94) -> Yellow: rgb(245, 158, 11)
    r = Math.round(34 + (245 - 34) * t);
    g = Math.round(197 + (158 - 197) * t);
    b = Math.round(94 + (11 - 94) * t);
  } else {
    // Yellow to Red (50% to 100%)
    const t = (clampedLevel - 50) / 50;
    // Yellow: rgb(245, 158, 11) -> Red: rgb(239, 68, 68)
    r = Math.round(245 + (239 - 245) * t);
    g = Math.round(158 + (68 - 158) * t);
    b = Math.round(11 + (68 - 11) * t);
  }
  
  return `rgb(${r}, ${g}, ${b})`;
};

// Custom icon for bins based on waste level with optional warning
const createBinIcon = (wasteLevel: number, isSelected: boolean = false, showWarning: boolean = false) => {
  // Use gradient color based on waste level
  const color = getGradientColor(wasteLevel);

  const size = isSelected ? 40 : 32;
  
  // If warning, add exclamation mark
  const warningBadge = showWarning ? `
    <circle cx="${size - 8}" cy="8" r="10" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
    <text x="${size - 8}" y="13" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold">!</text>
  ` : '';
  
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + (showWarning ? 4 : 0)}" viewBox="0 0 ${size} ${size + (showWarning ? 4 : 0)}">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" 
        transform="scale(${size/24})" 
        fill="${showWarning ? '#9ca3af' : color}" 
        stroke="${isSelected ? '#1e40af' : '#ffffff'}" 
        stroke-width="${isSelected ? 2 : 1.5}"/>
      <line x1="${size * 10/24}" y1="${size * 11/24}" x2="${size * 10/24}" y2="${size * 17/24}" stroke="#ffffff" stroke-width="2" transform="scale(${size/24})"/>
      <line x1="${size * 14/24}" y1="${size * 11/24}" x2="${size * 14/24}" y2="${size * 17/24}" stroke="#ffffff" stroke-width="2" transform="scale(${size/24})"/>
      ${warningBadge}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-bin-icon',
    iconSize: [size, size + (showWarning ? 4 : 0)],
    iconAnchor: [size / 2, size + (showWarning ? 4 : 0)],
    popupAnchor: [0, -(size + (showWarning ? 4 : 0))],
  });
};

// New bin location icon (draggable)
const createNewBinIcon = () => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="#eab308" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3" fill="#ffffff"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'new-bin-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  });
};

// User location icon (circle)
const userIcon = L.divIcon({
  html: `
    <div style="position: relative;">
      <div style="width: 20px; height: 20px; background: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; background: rgba(59, 130, 246, 0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
      }
    </style>
  `,
  className: 'user-location-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Navigation arrow icon (shows direction)
const createNavigationArrowIcon = (heading: number = 0) => {
  const svgIcon = `
    <div style="transform: rotate(${heading}deg); transition: transform 0.3s ease;">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));">
        <path d="M12 2L4 20h16L12 2z"/>
        <circle cx="12" cy="12" r="3" fill="#ffffff"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'navigation-arrow-icon',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

// Map tile URLs
const tileUrls: Record<MapTheme, { url: string; attribution: string }> = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

// Filter bins based on filter type
function filterBins(bins: Bin[], filter: BinFilter): Bin[] {
  switch (filter) {
    case 'empty':
      // ถังว่าง = wasteLevel < 50 และไม่มีปัญหา
      return bins.filter(b => b.wasteLevel < 50 && !shouldShowWarning(b));
    case 'medium':
      // ถังปานกลาง = 50-79% และไม่มีปัญหา
      return bins.filter(b => b.wasteLevel >= 50 && b.wasteLevel < 80 && !shouldShowWarning(b));
    case 'full':
      // ถังเต็ม = >= 80% และไม่มีปัญหา
      return bins.filter(b => b.wasteLevel >= 80 && !shouldShowWarning(b));
    case 'warning':
      // ถังมีปัญหา = ไม่มีข้อมูล sensor หรือออฟไลน์
      return bins.filter(b => shouldShowWarning(b));
    case 'offline':
      // ถังออฟไลน์ = ไม่มีการอัพเดตเกิน 1 ชม.
      return bins.filter(b => isBinOffline(b));
    default:
      return bins;
  }
}

// Component to handle map updates
function MapController() {
  const map = useMap();
  const { highlightedBinId, bins, userLocation, isLocating } = useAppStore();

  // Fly to highlighted bin
  useEffect(() => {
    if (highlightedBinId) {
      const bin = bins.find(b => b.id === highlightedBinId);
      if (bin && typeof bin.latitude === 'number' && typeof bin.longitude === 'number') {
        map.flyTo([bin.latitude, bin.longitude], 16, {
          duration: 1,
        });
      }
    }
  }, [highlightedBinId, bins, map]);

  // Fly to user location when locating
  useEffect(() => {
    if (isLocating && userLocation && 
        typeof userLocation.latitude === 'number' && 
        typeof userLocation.longitude === 'number') {
      map.flyTo([userLocation.latitude, userLocation.longitude], 15, {
        duration: 1,
      });
    }
  }, [isLocating, userLocation, map]);

  return null;
}

// Component to handle initial center on user location
function InitialLocationCenter() {
  const map = useMap();
  const { userLocation } = useAppStore();
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (userLocation && !hasCenteredRef.current && 
        typeof userLocation.latitude === 'number' && 
        typeof userLocation.longitude === 'number') {
      map.flyTo([userLocation.latitude, userLocation.longitude], 15, {
        duration: 1.5,
      });
      hasCenteredRef.current = true;
    }
  }, [userLocation, map]);

  return null;
}

// Component to handle map events
function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const { setMapCenter, setMapZoom, isAddingBin } = useAppStore();
  const lastCenterRef = useRef<[number, number] | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  
  useMapEvents({
    click: (e) => {
      if (isAddingBin) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
    moveend: (e) => {
      const center = e.target.getCenter();
      const newCenter: [number, number] = [center.lat, center.lng];
      
      // Only update if center has actually changed (more than 0.0001 degrees)
      if (!lastCenterRef.current || 
          Math.abs(lastCenterRef.current[0] - newCenter[0]) > 0.0001 ||
          Math.abs(lastCenterRef.current[1] - newCenter[1]) > 0.0001) {
        lastCenterRef.current = newCenter;
        setMapCenter(newCenter);
      }
    },
    zoomend: (e) => {
      const zoom = e.target.getZoom();
      
      // Only update if zoom has actually changed
      if (lastZoomRef.current !== zoom) {
        lastZoomRef.current = zoom;
        setMapZoom(zoom);
      }
    },
  });

  return null;
}

// Component to change cursor when in add mode
function CursorChanger() {
  const map = useMap();
  const { isAddingBin } = useAppStore();

  useEffect(() => {
    const container = map.getContainer();
    if (isAddingBin) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
    return () => {
      container.style.cursor = '';
    };
  }, [map, isAddingBin]);

  return null;
}

// Draggable marker for new bin
function DraggableNewBinMarker({ 
  position, 
  onDragEnd 
}: { 
  position: [number, number]; 
  onDragEnd: (lat: number, lng: number) => void;
}) {
  return (
    <Marker
      draggable={true}
      position={position}
      icon={createNewBinIcon()}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          onDragEnd(pos.lat, pos.lng);
        },
      }}
    >
      <Popup>
        <div className="p-2">
          <p className="font-medium text-sm">ตำแหน่งถังขยะใหม่</p>
          <p className="text-xs text-gray-500">ลากหมุดนี้เพื่อย้ายตำแหน่ง</p>
        </div>
      </Popup>
    </Marker>
  );
}

interface BinMarkerProps {
  bin: Bin;
  onSelect: (bin: Bin) => void;
  isSelected: boolean;
  isHighlighted: boolean;
}

function BinMarker({ bin, onSelect, isSelected, isHighlighted }: BinMarkerProps) {
  const showWarning = shouldShowWarning(bin);
  
  return (
    <Marker
      position={[bin.latitude, bin.longitude]}
      icon={createBinIcon(bin.wasteLevel, isSelected || isHighlighted, showWarning)}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-base">{bin.name}</h3>
            {showWarning && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                <AlertTriangle className="w-3 h-3" />
                ออฟไลน์
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-2">{bin.clientId}</p>
          <p className="text-sm text-gray-600 mb-2">{bin.address}</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium">ระดับขยะ:</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${bin.wasteLevel}%`,
                  backgroundColor: getGradientColor(bin.wasteLevel),
                }}
              />
            </div>
            <span className="text-xs font-bold">{bin.wasteLevel.toFixed(0)}%</span>
          </div>
          {isBinOffline(bin) && (
            <p className="text-xs text-red-500 mb-2">
              ไม่มีการอัพเดตเกิน 1 ชม.
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(bin);
            }}
            className="w-full bg-yellow-500 text-white text-sm py-1.5 rounded hover:bg-yellow-600 transition-colors"
          >
            ดูรายละเอียด
          </button>
        </div>
      </Popup>
    </Marker>
  );
}

// Bin Filter Component
function BinFilterControl() {
  const { binFilter, setBinFilter, bins } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const filterOptions: { value: BinFilter; label: string; color: string }[] = [
    { value: 'all', label: 'ทั้งหมด', color: 'bg-gray-500' },
    { value: 'empty', label: 'ว่าง (< 50%)', color: 'bg-green-500' },
    { value: 'medium', label: 'ปานกลาง (50-79%)', color: 'bg-yellow-500' },
    { value: 'full', label: 'เต็ม (≥ 80%)', color: 'bg-red-500' },
    { value: 'warning', label: 'มีปัญหา', color: 'bg-orange-500' },
    { value: 'offline', label: 'ออฟไลน์', color: 'bg-gray-400' },
  ];
  
  const currentFilter = filterOptions.find(f => f.value === binFilter);
  const filteredCount = filterBins(bins, binFilter).length;
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm"
      >
        <Filter className="w-4 h-4 text-gray-600" />
        <span className="font-medium text-gray-700">
          {currentFilter?.label}
        </span>
        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
          {filteredCount}
        </span>
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border z-20 min-w-[180px] overflow-hidden">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setBinFilter(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  binFilter === option.value ? 'bg-gray-50' : ''
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${option.color}`} />
                <span className="flex-1 text-left text-gray-700">{option.label}</span>
                <span className="text-xs text-gray-400">
                  {filterBins(bins, option.value).length}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface MapViewProps {
  onBinSelect: (bin: Bin) => void;
}

export default function MapView({ onBinSelect }: MapViewProps) {
  const { 
    bins, 
    mapTheme, 
    userLocation, 
    highlightedBinId, 
    selectedBin, 
    mapCenter,
    isAddingBin,
    newBinLocation,
    setNewBinLocation,
    routeInfo,
    isNavigating,
    binFilter,
  } = useAppStore();

  useEffect(() => {
    // Fix for default marker icons
    delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }, []);

  const handleMapClickForNewBin = useCallback((lat: number, lng: number) => {
    setNewBinLocation({ lat, lng });
  }, [setNewBinLocation]);

  const handleNewBinMarkerDrag = useCallback((lat: number, lng: number) => {
    setNewBinLocation({ lat, lng });
  }, [setNewBinLocation]);

  const tileConfig = tileUrls[mapTheme];
  
  // Filter bins based on current filter
  const filteredBins = filterBins(bins, binFilter);

  return (
    <>
      {/* Bin Filter Control */}
      <div className="absolute top-32 left-4 z-20">
        <BinFilterControl />
      </div>
      
      <MapContainer
        center={mapCenter}
        zoom={12}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution={tileConfig.attribution}
          url={tileConfig.url}
        />
        <MapController />
        <MapEventsHandler onMapClick={handleMapClickForNewBin} />
        <InitialLocationCenter />
        <CursorChanger />
        
        {/* Route polyline */}
        {isNavigating && routeInfo && routeInfo.coordinates.length > 0 && (
          <Polyline
            positions={routeInfo.coordinates}
            color="#3b82f6"
            weight={6}
            opacity={0.9}
          />
        )}
        
        {/* User location marker - Arrow when navigating, circle otherwise */}
        {userLocation && 
         typeof userLocation.latitude === 'number' && 
         typeof userLocation.longitude === 'number' && (
          <>
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              icon={isNavigating 
                ? createNavigationArrowIcon(userLocation.heading || 0)
                : userIcon
              }
            />
            {!isNavigating && (
              <Circle
                center={[userLocation.latitude, userLocation.longitude]}
                radius={100}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.1,
                  weight: 1,
                }}
              />
            )}
          </>
        )}

        {/* New bin marker (when in add mode) */}
        {isAddingBin && newBinLocation && (
          <DraggableNewBinMarker
            position={[newBinLocation.lat, newBinLocation.lng]}
            onDragEnd={handleNewBinMarkerDrag}
          />
        )}

        {/* Bin markers - filtered */}
        {filteredBins.map((bin) => (
          <BinMarker
            key={bin.id}
            bin={bin}
            onSelect={onBinSelect}
            isSelected={selectedBin?.id === bin.id}
            isHighlighted={highlightedBinId === bin.id}
          />
        ))}
      </MapContainer>
    </>
  );
}
