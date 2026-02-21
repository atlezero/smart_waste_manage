import { create } from 'zustand';

export interface Bin {
  id: string;
  clientId: string;
  name: string;
  address: string;
  district: string | null;
  subDistrict: string | null;
  province: string | null;
  municipality: string | null;
  latitude: number;
  longitude: number;
  capacity: number;
  maxDistance: number;
  wasteLevel: number;
  lightLevel: number;
  lightStatus: boolean;
  temperature: number | null;
  humidity: number | null;
  isActive: boolean;
  lastUpdate: string;
  createdAt: string;
  updatedAt: string;
  sensorHistory?: SensorHistory[];
}

export interface SensorHistory {
  id: string;
  binId: string;
  wasteLevel: number;
  lightLevel: number;
  lightStatus: boolean;
  temperature: number | null;
  humidity: number | null;
  recordedAt: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  address: string;
  heading?: number; // Direction in degrees
}

export type MapTheme = 'streets' | 'satellite' | 'dark' | 'light';

export type ViewMode = 'map' | 'dashboard';

export type BinFilter = 'all' | 'empty' | 'medium' | 'full' | 'warning' | 'offline';

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver: string;
  name: string;
}

export interface RouteInfo {
  distance: string;
  duration: string;
  steps: RouteStep[];
  coordinates: [number, number][];
}

interface AppState {
  // Bins
  bins: Bin[];
  selectedBin: Bin | null;
  highlightedBinId: string | null;
  binFilter: BinFilter;
  
  // User location
  userLocation: UserLocation | null;
  isLocating: boolean;
  locationError: string | null;
  
  // Map
  mapTheme: MapTheme;
  mapCenter: [number, number];
  mapZoom: number;
  
  // UI
  viewMode: ViewMode;
  searchQuery: string;
  isLoading: boolean;
  
  // Add bin mode
  isAddingBin: boolean;
  newBinLocation: { lat: number; lng: number } | null;
  
  // Navigation
  isNavigating: boolean;
  routeInfo: RouteInfo | null;
  navigationTarget: Bin | null;
  currentStepIndex: number;
  
  // Actions
  setBins: (bins: Bin[]) => void;
  addBin: (bin: Bin) => void;
  updateBin: (bin: Bin) => void;
  removeBin: (id: string) => void;
  setSelectedBin: (bin: Bin | null) => void;
  setHighlightedBinId: (id: string | null) => void;
  setBinFilter: (filter: BinFilter) => void;
  
  setUserLocation: (location: UserLocation | null) => void;
  setIsLocating: (isLocating: boolean) => void;
  setLocationError: (error: string | null) => void;
  
  setMapTheme: (theme: MapTheme) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setIsLoading: (loading: boolean) => void;
  
  setIsAddingBin: (isAdding: boolean) => void;
  setNewBinLocation: (location: { lat: number; lng: number } | null) => void;
  
  startNavigation: (target: Bin, route: RouteInfo) => void;
  stopNavigation: () => void;
  setCurrentStepIndex: (index: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  bins: [],
  selectedBin: null,
  highlightedBinId: null,
  binFilter: 'all',
  
  userLocation: null,
  isLocating: false,
  locationError: null,
  
  mapTheme: 'streets',
  mapCenter: [13.7563, 100.5018], // Bangkok default
  mapZoom: 12,
  
  viewMode: 'map',
  searchQuery: '',
  isLoading: true,
  
  isAddingBin: false,
  newBinLocation: null,
  
  isNavigating: false,
  routeInfo: null,
  navigationTarget: null,
  currentStepIndex: 0,
  
  // Actions
  setBins: (bins) => set({ bins }),
  addBin: (bin) => set((state) => ({ bins: [...state.bins, bin] })),
  updateBin: (bin) => set((state) => ({
    bins: state.bins.map((b) => (b.id === bin.id ? bin : b)),
    selectedBin: state.selectedBin?.id === bin.id ? bin : state.selectedBin,
  })),
  removeBin: (id) => set((state) => ({
    bins: state.bins.filter((b) => b.id !== id),
    selectedBin: state.selectedBin?.id === id ? null : state.selectedBin,
  })),
  setSelectedBin: (bin) => set({ selectedBin: bin }),
  setHighlightedBinId: (id) => set({ highlightedBinId: id }),
  setBinFilter: (filter) => set({ binFilter: filter }),
  
  setUserLocation: (location) => set({ userLocation: location }),
  setIsLocating: (isLocating) => set({ isLocating }),
  setLocationError: (error) => set({ locationError: error }),
  
  setMapTheme: (theme) => set({ mapTheme: theme }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  setIsAddingBin: (isAdding) => set({ isAddingBin: isAdding }),
  setNewBinLocation: (location) => set({ newBinLocation: location }),
  
  startNavigation: (target, route) => set({
    isNavigating: true,
    navigationTarget: target,
    routeInfo: route,
    currentStepIndex: 0,
    selectedBin: null, // Close modal
  }),
  stopNavigation: () => set({
    isNavigating: false,
    navigationTarget: null,
    routeInfo: null,
    currentStepIndex: 0,
  }),
  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
}));
