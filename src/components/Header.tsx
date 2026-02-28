'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Map, LayoutDashboard, Layers, Sun, Moon, Locate, Plus, Menu, X, Crosshair, XCircle, Key, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore, MapTheme } from '@/store/app-store';
import { useState } from 'react';
import { signOut } from 'next-auth/react';

const mapThemes: { value: MapTheme; label: string; icon: React.ElementType }[] = [
  { value: 'streets', label: 'แผนที่ทั่วไป', icon: Map },
  { value: 'satellite', label: 'ดาวเทียม', icon: Layers },
  { value: 'light', label: 'สว่าง', icon: Sun },
  { value: 'dark', label: 'มืด', icon: Moon },
];

export default function Header() {
  const {
    viewMode,
    setViewMode,
    mapTheme,
    setMapTheme,
    userLocation,
    isAddingBin,
    setIsAddingBin,
    setNewBinLocation,
    setMapCenter,
  } = useAppStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleCenterOnUser = () => {
    if (userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
      setMapCenter([userLocation.latitude, userLocation.longitude]);
    }
  };

  const handleToggleAddBin = () => {
    if (isAddingBin) {
      // Cancel add bin mode
      setIsAddingBin(false);
      setNewBinLocation(null);
    } else {
      // Enter add bin mode
      setIsAddingBin(true);
      setNewBinLocation(null);
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-30 p-4">
      <div className="flex items-center justify-between">
        {/* Logo and Title - Only show in map view */}
        <AnimatePresence>
          {viewMode === 'map' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3"
            >
              <div className="bg-white p-2 rounded-xl shadow-lg">
                <div className="bg-yellow-500 text-white p-2 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-lg text-gray-800">ระบบจัดการถังขยะ</h1>
                <p className="text-xs text-gray-500">เทศบาลเมือง</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Placeholder for dashboard view to maintain layout */}
        {viewMode === 'dashboard' && <div />}

        {/* Add bin mode indicator */}
        <AnimatePresence>
          {isAddingBin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="hidden md:flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-xl shadow-lg"
            >
              <Crosshair className="w-5 h-5 animate-pulse" />
              <span className="font-medium">จิ้มบนแผนที่เพื่อวางถังขยะ</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-white/90 backdrop-blur rounded-xl p-1 shadow-lg flex gap-1">
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
              className={`rounded-lg ${viewMode === 'map' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
            >
              <Map className="w-4 h-4 mr-1" />
              แผนที่
            </Button>
            <Button
              variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('dashboard')}
              className={`rounded-lg ${viewMode === 'dashboard' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
            >
              <LayoutDashboard className="w-4 h-4 mr-1" />
              แดชบอร์ด
            </Button>
          </div>

          {/* Map Theme Selector */}
          {viewMode === 'map' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/90 backdrop-blur shadow-lg rounded-xl"
                >
                  <Layers className="w-4 h-4 mr-1" />
                  {mapThemes.find(t => t.value === mapTheme)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {mapThemes.map((theme) => (
                  <DropdownMenuItem
                    key={theme.value}
                    onClick={() => setMapTheme(theme.value)}
                    className={`cursor-pointer ${mapTheme === theme.value ? 'bg-yellow-50' : ''}`}
                  >
                    <theme.icon className="w-4 h-4 mr-2" />
                    {theme.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Center on User Button */}
          {viewMode === 'map' && userLocation && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCenterOnUser}
              className="bg-white/90 backdrop-blur shadow-lg rounded-xl"
            >
              <Locate className="w-4 h-4 mr-1" />
              ตำแหน่งของฉัน
            </Button>
          )}

          {/* Add/Cancel Bin Button */}
          {viewMode === 'map' && (
            <Button
              onClick={handleToggleAddBin}
              className={`shadow-lg rounded-xl ${isAddingBin
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }`}
            >
              {isAddingBin ? (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  ยกเลิก
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  เพิ่มถังขยะ
                </>
              )}
            </Button>
          )}

          {/* API Keys Button */}
          <Link href="/api-keys">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/90 backdrop-blur shadow-lg rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Key className="w-4 h-4 mr-1" />
              API Keys
            </Button>
          </Link>

          {/* Logout Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="bg-white/90 backdrop-blur shadow-lg rounded-xl border-red-200 text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-1" />
            ออกจากระบบ
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden mt-4 bg-white/95 backdrop-blur rounded-xl shadow-lg p-4 space-y-3"
        >
          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('map');
                setIsMobileMenuOpen(false);
              }}
              className={`flex-1 rounded-lg ${viewMode === 'map' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
            >
              <Map className="w-4 h-4 mr-1" />
              แผนที่
            </Button>
            <Button
              variant={viewMode === 'dashboard' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className={`flex-1 rounded-lg ${viewMode === 'dashboard' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
            >
              <LayoutDashboard className="w-4 h-4 mr-1" />
              แดชบอร์ด
            </Button>
          </div>

          {/* Map Theme Selector */}
          {viewMode === 'map' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full rounded-lg">
                  <Layers className="w-4 h-4 mr-1" />
                  {mapThemes.find(t => t.value === mapTheme)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-full rounded-xl">
                {mapThemes.map((theme) => (
                  <DropdownMenuItem
                    key={theme.value}
                    onClick={() => {
                      setMapTheme(theme.value);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`cursor-pointer ${mapTheme === theme.value ? 'bg-yellow-50' : ''}`}
                  >
                    <theme.icon className="w-4 h-4 mr-2" />
                    {theme.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Center on User Button */}
          {viewMode === 'map' && userLocation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleCenterOnUser();
                setIsMobileMenuOpen(false);
              }}
              className="w-full rounded-lg"
            >
              <Locate className="w-4 h-4 mr-1" />
              ตำแหน่งของฉัน
            </Button>
          )}

          {/* Add/Cancel Bin Button */}
          {viewMode === 'map' && (
            <Button
              onClick={handleToggleAddBin}
              className={`w-full rounded-lg ${isAddingBin
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }`}
            >
              {isAddingBin ? (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  ยกเลิกการเพิ่ม
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  เพิ่มถังขยะ
                </>
              )}
            </Button>
          )}

          {/* API Keys Button for Mobile */}
          <Link href="/api-keys" className="w-full">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Key className="w-4 h-4 mr-1" />
              จัดการ API Keys
            </Button>
          </Link>

          {/* Add bin mode indicator for mobile */}
          {isAddingBin && (
            <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm">
              <Crosshair className="w-4 h-4 animate-pulse" />
              <span>จิ้มบนแผนที่เพื่อวางถังขยะ</span>
            </div>
          )}

          {/* Logout Button for Mobile */}
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-lg border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="w-4 h-4 mr-1" />
            ออกจากระบบ
          </Button>
        </motion.div>
      )}
    </header>
  );
}
