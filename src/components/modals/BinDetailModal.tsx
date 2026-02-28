'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Trash2, Lightbulb, Thermometer, Droplets, Navigation, Clock, Edit, Trash, Loader2, ExternalLink, Save, XCircle, Key, Copy, Check, Wifi, WifiOff } from 'lucide-react';
import { Bin, useAppStore, RouteInfo, RouteStep } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

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

interface BinDetailModalProps {
  bin: Bin | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (bin: Bin) => void;
}

// Format distance for display
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} กม.`;
  }
  return `${Math.round(meters)} ม.`;
}

// Format duration for display
function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} น.`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours} ชม. ${remainingMins} น.`;
}

// Get instruction text from maneuver type and modifier
function getInstructionText(maneuverType: string, maneuverModifier: string, roadName: string): string {
  const name = roadName || 'ถนนไม่ทราบชื่อ';
  const modifier = maneuverModifier?.toLowerCase() || '';

  if (maneuverType === 'turn') {
    if (modifier.includes('sharp left')) return `เลี้ยวซ้ายแฉกที่ ${name}`;
    if (modifier.includes('sharp right')) return `เลี้ยวขวาแฉกที่ ${name}`;
    if (modifier.includes('slight left')) return `เลี้ยวซ้ายเล็กน้อยที่ ${name}`;
    if (modifier.includes('slight right')) return `เลี้ยวขวาเล็กน้อยที่ ${name}`;
    if (modifier.includes('left')) return `เลี้ยวซ้ายที่ ${name}`;
    if (modifier.includes('right')) return `เลี้ยวขวาที่ ${name}`;
    if (modifier.includes('uturn')) return `กลับรถที่ ${name}`;
    return `เลี้ยวที่ ${name}`;
  }

  if (maneuverType === 'new name' || maneuverType === 'continue') {
    if (modifier.includes('slight left')) return `เบี่ยงซ้ายเล็กน้อยเข้าสู่ ${name}`;
    if (modifier.includes('slight right')) return `เบี่ยงขวาเล็กน้อยเข้าสู่ ${name}`;
    if (modifier.includes('left')) return `เบี่ยงซ้ายเข้าสู่ ${name}`;
    if (modifier.includes('right')) return `เบี่ยงขวาเข้าสู่ ${name}`;
    return `ไปตรงบน ${name}`;
  }

  if (maneuverType === 'merge') {
    if (modifier.includes('left')) return `รวมเข้าซ้ายสู่ ${name}`;
    if (modifier.includes('right')) return `รวมเข้าขวาสู่ ${name}`;
    return `รวมเข้า ${name}`;
  }

  if (maneuverType === 'roundabout') return `เข้าวงเวียน แล้วออกที่ ${name}`;
  if (maneuverType === 'arrive') return `ถึงปลายทาง`;
  if (maneuverType === 'depart') return `เริ่มต้นจาก ${name}`;

  if (maneuverType === 'on ramp') {
    if (modifier.includes('left')) return `ขึ้นทางลงซ้าย ${name}`;
    if (modifier.includes('right')) return `ขึ้นทางลงขวา ${name}`;
    return `ขึ้นทางลง ${name}`;
  }
  if (maneuverType === 'off ramp') {
    if (modifier.includes('left')) return `ลงทางลงซ้าย ${name}`;
    if (modifier.includes('right')) return `ลงทางลงขวา ${name}`;
    return `ลงทางลง ${name}`;
  }

  if (maneuverType === 'fork') {
    if (modifier.includes('left')) return `เลือกแยกซ้ายไป ${name}`;
    if (modifier.includes('right')) return `เลือกแยกขวาไป ${name}`;
    return `แยกไป ${name}`;
  }

  return `ไปทาง ${name}`;
}

export default function BinDetailModal({
  bin,
  isOpen,
  onClose,
  onDelete,
}: BinDetailModalProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name || '';
  const isAdmin = session?.user?.email?.includes('admin') || false;

  const canDelete = isAdmin || (bin?.createdBy && bin.createdBy === userName);

  const { userLocation, startNavigation, updateBin } = useAppStore();
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    district: '',
    subDistrict: '',
    province: '',
    municipality: '',
    capacity: 100,
    maxDistance: 400,
  });

  useEffect(() => {
    if (bin && bin.lastUpdate) {
      const checkStatus = () => {
        const lastTime = new Date(bin.lastUpdate).getTime();
        setIsOnline(Date.now() - lastTime <= 60000); // 1 minute
      };
      checkStatus();
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
    } else {
      setIsOnline(false);
    }
  }, [bin]);

  // Initialize edit form when bin changes
  useState(() => {
    if (bin) {
      setEditForm({
        name: bin.name,
        address: bin.address,
        district: bin.district || '',
        subDistrict: bin.subDistrict || '',
        province: bin.province || '',
        municipality: bin.municipality || '',
        capacity: bin.capacity,
        maxDistance: bin.maxDistance,
      });
    }
  });

  // Reset form when bin changes
  const resetEditForm = () => {
    if (bin) {
      setEditForm({
        name: bin.name,
        address: bin.address,
        district: bin.district || '',
        subDistrict: bin.subDistrict || '',
        province: bin.province || '',
        municipality: bin.municipality || '',
        capacity: bin.capacity,
        maxDistance: bin.maxDistance,
      });
    }
  };

  const getWasteLevelColor = (level: number) => {
    if (level >= 80) return 'bg-red-500';
    if (level >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getWasteLevelText = (level: number) => {
    if (level >= 80) return 'เต็ม';
    if (level >= 50) return 'ปานกลาง';
    return 'ว่าง';
  };

  const getWasteLevelBadgeVariant = (level: number): "default" | "secondary" | "destructive" => {
    if (level >= 80) return 'destructive';
    if (level >= 50) return 'default';
    return 'secondary';
  };

  const handleNavigate = async () => {
    if (!bin || !userLocation) return;

    if (typeof userLocation.latitude !== 'number' || typeof userLocation.longitude !== 'number' ||
      isNaN(userLocation.latitude) || isNaN(userLocation.longitude)) {
      toast.error('ไม่พบตำแหน่งของคุณ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    setIsLoadingRoute(true);

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${bin.longitude},${bin.latitude}?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (coord: number[]) => [coord[1], coord[0]]
        );

        const steps: RouteStep[] = [];
        if (route.legs && route.legs.length > 0) {
          route.legs.forEach((leg: {
            steps: {
              maneuver: { type: string; modifier?: string; location: number[] };
              name: string;
              distance: number;
              duration: number
            }[]
          }) => {
            leg.steps.forEach((step) => {
              steps.push({
                instruction: getInstructionText(
                  step.maneuver.type,
                  step.maneuver.modifier || '',
                  step.name
                ),
                distance: formatDistance(step.distance),
                duration: formatDuration(step.duration),
                maneuver: step.maneuver.type,
                name: step.name || '',
              });
            });
          });
        }

        const routeInfo: RouteInfo = {
          distance: formatDistance(route.distance),
          duration: formatDuration(route.duration),
          steps,
          coordinates,
        };

        startNavigation(bin, routeInfo);
        toast.success('เริ่มนำทางแล้ว');
      } else {
        throw new Error(data.message || 'No route found');
      }
    } catch (error) {
      console.error('Routing error:', error);
      toast.error('ไม่สามารถคำนวณเส้นทางได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!bin) return;

    const googleMapsUrl = userLocation
      ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${bin.latitude},${bin.longitude}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${bin.latitude},${bin.longitude}`;

    window.open(googleMapsUrl, '_blank');
  };

  const handleEditClick = () => {
    resetEditForm();
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    resetEditForm();
    setIsEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!bin) return;

    if (!editForm.name.trim()) {
      toast.error('กรุณากรอกชื่อถังขยะ');
      return;
    }

    if (!editForm.address.trim()) {
      toast.error('กรุณากรอกที่อยู่');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/bins/${bin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        const updatedBin: Bin = {
          ...bin,
          name: editForm.name,
          address: editForm.address,
          district: editForm.district || null,
          subDistrict: editForm.subDistrict || null,
          province: editForm.province || null,
          municipality: editForm.municipality || null,
          capacity: editForm.capacity,
          maxDistance: editForm.maxDistance,
          updatedAt: new Date().toISOString(),
        };

        updateBin(updatedBin);
        toast.success('บันทึกข้อมูลสำเร็จ');
        setIsEditMode(false);
      } else {
        toast.error(result.error || 'ไม่สามารถบันทึกข้อมูลได้');
      }
    } catch (error) {
      console.error('Failed to update bin:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLight = async (type: 'main' | 'green' | 'red' | 'auto' | 'auto_status') => {
    if (!bin) return;

    if (!isOnline) {
      toast.error('ไม่สามารถส่งคำสั่งได้ อุปกรณ์ออฟไลน์');
      return;
    }

    // กำหนดค่าใหม่ที่ต้องการ toggle
    const newLightStatus = type === 'main' ? !bin.lightStatus : bin.lightStatus;
    const newLedGreen = type === 'green' ? !bin.ledGreen : bin.ledGreen;
    const newLedRed = type === 'red' ? !bin.ledRed : bin.ledRed;
    const newAutoLight = type === 'auto' ? !bin.autoLight : bin.autoLight;
    const newAutoStatus = type === 'auto_status' ? !bin.autoStatus : bin.autoStatus;

    // สร้าง command ที่ส่งไปยัง ESP32 ผ่าน MQTT topic: waste_truck/<api_key>/cmd
    const command: Record<string, boolean> = {};
    if (type === 'main') command.light = newLightStatus;
    if (type === 'green') command.green = newLedGreen;
    if (type === 'red') command.red = newLedRed;
    if (type === 'auto') command.auto_light = newAutoLight;
    if (type === 'auto_status') command.auto_status = newAutoStatus;

    // Optimistic update UI ทันที
    updateBin({
      ...bin,
      lightStatus: newLightStatus,
      ledGreen: newLedGreen,
      ledRed: newLedRed,
      autoLight: newAutoLight,
      autoStatus: newAutoStatus,
    });

    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binId: bin.id, command }),
      });
      const result = await response.json();

      if (result.success) {
        if (result.mqttStatus === 'offline') {
          toast.warning('อัปเดต DB แล้ว แต่ MQTT offline — ESP32 จะซิงค์ครั้งถัดไป');
        } else {
          toast.success(`ส่งคำสั่ง${type === 'main' ? 'ไฟส่องสว่าง' : type === 'green' ? 'LED เขียว' : type === 'red' ? 'LED แดง' : type === 'auto_status' ? 'โหมดสถานะออโต้' : 'โหมดสว่างออโต้'}สำเร็จ`);
        }
      } else {
        // ถ้า error ให้ revert UI กลับ
        updateBin(bin);
        toast.error(result.error || 'ไม่สามารถส่งคำสั่งได้');
      }
    } catch (error) {
      console.error('Failed to toggle light', error);
      updateBin(bin); // revert
      toast.error('ไม่สามารถส่งคำสั่งได้');
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!bin) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
          >
            {/* Header */}
            <div className={`sticky top-0 p-4 text-white z-10 ${isEditMode ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-yellow-400 to-yellow-500'}`}>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold pr-8">
                {isEditMode ? 'แก้ไขถังขยะ' : bin.name}
              </h2>
              {!isEditMode && (
                <div className="flex items-center gap-3 mt-1">

                  <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shadow-sm ${isOnline ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {isOnline ? (
                      <><Wifi className="w-3 h-3" /> ออนไลน์</>
                    ) : (
                      <><WifiOff className="w-3 h-3" /> ออฟไลน์</>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {isEditMode ? (
                /* Edit Form */
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <Label htmlFor="edit-name" className="text-sm font-medium">
                      ชื่อถังขยะ <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="ชื่อถังขยะ"
                      className="mt-1"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <Label htmlFor="edit-address" className="text-sm font-medium">
                      ที่อยู่ <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-address"
                      value={editForm.address}
                      onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="ที่อยู่"
                      className="mt-1"
                    />
                  </div>

                  {/* District Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-subDistrict" className="text-sm font-medium">
                        แขวง/ตำบล
                      </Label>
                      <Input
                        id="edit-subDistrict"
                        value={editForm.subDistrict}
                        onChange={(e) => setEditForm(prev => ({ ...prev, subDistrict: e.target.value }))}
                        placeholder="แขวง/ตำบล"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-district" className="text-sm font-medium">
                        เขต/อำเภอ
                      </Label>
                      <Input
                        id="edit-district"
                        value={editForm.district}
                        onChange={(e) => setEditForm(prev => ({ ...prev, district: e.target.value }))}
                        placeholder="เขต/อำเภอ"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-municipality" className="text-sm font-medium">
                        เทศบาล
                      </Label>
                      <Input
                        id="edit-municipality"
                        value={editForm.municipality}
                        onChange={(e) => setEditForm(prev => ({ ...prev, municipality: e.target.value }))}
                        placeholder="เทศบาล"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-province" className="text-sm font-medium">
                        จังหวัด
                      </Label>
                      <Input
                        id="edit-province"
                        value={editForm.province}
                        onChange={(e) => setEditForm(prev => ({ ...prev, province: e.target.value }))}
                        placeholder="จังหวัด"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Capacity & MaxDistance */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-capacity" className="text-sm font-medium">
                        ความจุ (ลิตร)
                      </Label>
                      <Input
                        id="edit-capacity"
                        type="number"
                        value={editForm.capacity}
                        onChange={(e) => setEditForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 100 }))}
                        placeholder="100"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-maxDistance" className="text-sm font-medium">
                        ความสูงถัง (ซม.)
                      </Label>
                      <Input
                        id="edit-maxDistance"
                        type="number"
                        value={editForm.maxDistance}
                        onChange={(e) => setEditForm(prev => ({ ...prev, maxDistance: parseInt(e.target.value) || 100 }))}
                        placeholder="100"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Coordinates (read-only) */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-700">พิกัด (อ่านอย่างเดียว)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-2 rounded-lg border">
                        <span className="text-xs text-gray-500">ละติจูด</span>
                        <p className="font-medium text-gray-800">{bin.latitude.toFixed(6)}</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border">
                        <span className="text-xs text-gray-500">ลองจิจูด</span>
                        <p className="font-medium text-gray-800">{bin.longitude.toFixed(6)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Edit Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                      className="flex-1"
                      disabled={isSaving}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          บันทึก...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          บันทึก
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  {/* Location */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-800">{bin.address}</p>
                        {(bin.district || bin.subDistrict || bin.province || bin.municipality) && (
                          <p className="text-sm text-gray-500 mt-1">
                            {[bin.subDistrict, bin.district, bin.municipality, bin.province]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Waste Level */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-yellow-500" />
                        <span className="font-medium text-gray-800">ระดับขยะ</span>
                      </div>
                      <Badge variant={getWasteLevelBadgeVariant(bin.wasteLevel)}>
                        {getWasteLevelText(bin.wasteLevel)}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500 ease-out rounded-full"
                          style={{
                            width: `${bin.wasteLevel}%`,
                            backgroundColor: getGradientColor(bin.wasteLevel),
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">เปอร์เซ็นต์ขยะ</span>
                        <span className="font-bold text-gray-800">{bin.wasteLevel.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 border-t pt-1 mt-1">
                        <span>ระยะเซนเซอร์วัดได้ล่าสุด</span>
                        <span>{((100 - bin.wasteLevel) / 100 * (bin.maxDistance - 2) + 2).toFixed(1)} ซม.</span>
                      </div>
                    </div>
                  </div>

                  {/* Light Status */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className={`w-5 h-5 ${bin.lightStatus ? 'text-yellow-400' : 'text-gray-400'}`} />
                        <span className="font-medium text-gray-800">ไฟส่องสว่างหลัก</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={bin.lightStatus ? 'default' : 'secondary'}>
                          {bin.lightStatus ? 'เปิด' : 'ปิด'}
                        </Badge>
                        <Switch checked={bin.lightStatus} onCheckedChange={() => toggleLight('main')} disabled={!isOnline || bin.autoLight} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className={`w-5 h-5 ${bin.autoLight ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className="font-medium text-gray-800">โหมดสว่างอัตโนมัติ (วัดแสง)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={bin.autoLight ? 'default' : 'secondary'} className={bin.autoLight ? 'bg-blue-500' : ''}>
                          {bin.autoLight ? 'เปิด' : 'ปิด'}
                        </Badge>
                        <Switch checked={bin.autoLight} onCheckedChange={() => toggleLight('auto')} disabled={!isOnline} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className={`w-5 h-5 ${bin.autoStatus ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className="font-medium text-gray-800">โหมดไฟสถานะอัตโนมัติ (เต็ม/ว่าง)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={bin.autoStatus ? 'default' : 'secondary'} className={bin.autoStatus ? 'bg-blue-500' : ''}>
                          {bin.autoStatus ? 'เปิด' : 'ปิด'}
                        </Badge>
                        <Switch checked={bin.autoStatus} onCheckedChange={() => toggleLight('auto_status')} disabled={!isOnline} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className={`w-5 h-5 ${bin.ledGreen ? 'text-green-500' : 'text-gray-400'}`} />
                        <span className="font-medium text-gray-800">สถานะ LED สีเขียว</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={bin.ledGreen ? 'default' : 'secondary'} className={bin.ledGreen ? 'bg-green-500' : ''}>
                          {bin.ledGreen ? 'เปิด' : 'ปิด'}
                        </Badge>
                        <Switch checked={bin.ledGreen} onCheckedChange={() => toggleLight('green')} disabled={!isOnline || bin.autoStatus} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className={`w-5 h-5 ${bin.ledRed ? 'text-red-500' : 'text-gray-400'}`} />
                        <span className="font-medium text-gray-800">สถานะ LED สีแดง</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={bin.ledRed ? 'destructive' : 'secondary'}>
                          {bin.ledRed ? 'เปิด' : 'ปิด'}
                        </Badge>
                        <Switch checked={bin.ledRed} onCheckedChange={() => toggleLight('red')} disabled={!isOnline || bin.autoStatus} />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-gray-500">ระดับแสง</span>
                      <span className="font-medium text-gray-800">{bin.lightLevel.toFixed(1)} lux</span>
                    </div>
                  </div>

                  {/* Temperature & Humidity */}
                  {(bin.temperature !== null || bin.humidity !== null) && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {bin.temperature !== null && (
                          <div className="flex items-center gap-2">
                            <Thermometer className="w-5 h-5 text-red-400" />
                            <div>
                              <p className="text-xs text-gray-500">อุณหภูมิ</p>
                              <p className="font-medium text-gray-800">{bin.temperature.toFixed(1)}°C</p>
                            </div>
                          </div>
                        )}
                        {bin.humidity !== null && (
                          <div className="flex items-center gap-2">
                            <Droplets className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-xs text-gray-500">ความชื้น</p>
                              <p className="font-medium text-gray-800">{bin.humidity.toFixed(1)}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Capacity Info & Creator */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">ความจุ</p>
                        <p className="font-medium text-gray-800">{bin.capacity} ลิตร</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">ความสูงถัง</p>
                        <p className="font-medium text-gray-800">{bin.maxDistance} ซม.</p>
                      </div>
                      <div className="col-span-2 mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">ผู้สร้างข้อมูล</p>
                        <p className="font-medium text-gray-800">{bin.createdBy || 'Unknown'} {bin.createdByRole && `(${bin.createdByRole})`}</p>
                      </div>
                    </div>
                  </div>

                  {/* Last Update */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
                    <Clock className="w-4 h-4" />
                    <span>อัพเดทล่าสุด: {formatDateTime(bin.lastUpdate)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleNavigate}
                      disabled={isLoadingRoute || !userLocation}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                    >
                      {isLoadingRoute ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          คำนวณ...
                        </>
                      ) : (
                        <>
                          <Navigation className="w-4 h-4 mr-2" />
                          นำทาง
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenGoogleMaps}
                      className="flex-shrink-0 border-green-500 text-green-600 hover:bg-green-50"
                      title="เปิดใน Google Maps"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleEditClick}
                      className="flex-shrink-0 border-blue-500 text-blue-600 hover:bg-blue-50"
                      title="แก้ไข"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {onDelete && canDelete && (
                      <Button
                        variant="outline"
                        onClick={() => onDelete(bin)}
                        className="flex-shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {!userLocation && (
                    <p className="text-xs text-center text-gray-400">
                      กรุณาอนุญาตให้เข้าถึงตำแหน่งของคุณเพื่อใช้งานการนำทาง
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )
      }
    </AnimatePresence >
  );
}
