'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, MapPin, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/app-store';

interface AddBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddBinData) => Promise<void>;
}

export interface AddBinData {
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
}

export default function AddBinModal({ isOpen, onClose, onSubmit }: AddBinModalProps) {
  const { newBinLocation, userLocation } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<AddBinData>({
    name: '',
    address: '',
    district: '',
    subDistrict: '',
    province: '',
    municipality: '',
    latitude: newBinLocation?.lat || userLocation?.latitude || 13.7563,
    longitude: newBinLocation?.lng || userLocation?.longitude || 100.5018,
    capacity: 100,
    maxDistance: 100,
  });

  // Update coordinates when newBinLocation changes
  useEffect(() => {
    if (newBinLocation) {
      setFormData(prev => ({
        ...prev,
        latitude: newBinLocation.lat,
        longitude: newBinLocation.lng,
      }));
    }
  }, [newBinLocation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        name: '',
        address: '',
        district: '',
        subDistrict: '',
        province: '',
        municipality: '',
        latitude: userLocation?.latitude || 13.7563,
        longitude: userLocation?.longitude || 100.5018,
        capacity: 100,
        maxDistance: 100,
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

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
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-white">เพิ่มถังขยะใหม่</h2>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                disabled={isLoading}
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* API Key info hint */}
            <div className="bg-blue-50 px-6 py-3 flex items-center gap-2 border-b border-blue-100">
              <Key className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-blue-800">
                API Key จะถูกสร้างอัตโนมัติเมื่อเพิ่มถังขยะ
              </span>
            </div>

            {/* Location hint */}
            <div className="bg-yellow-50 px-6 py-3 flex items-center gap-2 border-b border-yellow-100">
              <MapPin className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                จิ้มบนแผนที่เพื่อเปลี่ยนตำแหน่ง หรือลากหมุดสีเหลือง
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Bin Name */}
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  ชื่อถังขยะ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="เช่น ถังขยะหน้าโรงเรียน"
                  required
                  className="mt-1"
                  disabled={isLoading}
                />
              </div>

              {/* Address */}
              <div>
                <Label htmlFor="address" className="text-sm font-medium">
                  ที่อยู่ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="ที่อยู่"
                  required
                  className="mt-1"
                  disabled={isLoading}
                />
              </div>

              {/* District Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="subDistrict" className="text-sm font-medium">
                    แขวง/ตำบล
                  </Label>
                  <Input
                    id="subDistrict"
                    name="subDistrict"
                    value={formData.subDistrict || ''}
                    onChange={handleInputChange}
                    placeholder="แขวง/ตำบล"
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="district" className="text-sm font-medium">
                    เขต/อำเภอ
                  </Label>
                  <Input
                    id="district"
                    name="district"
                    value={formData.district || ''}
                    onChange={handleInputChange}
                    placeholder="เขต/อำเภอ"
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="municipality" className="text-sm font-medium">
                    เทศบาล
                  </Label>
                  <Input
                    id="municipality"
                    name="municipality"
                    value={formData.municipality || ''}
                    onChange={handleInputChange}
                    placeholder="เทศบาล"
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="province" className="text-sm font-medium">
                    จังหวัด
                  </Label>
                  <Input
                    id="province"
                    name="province"
                    value={formData.province || ''}
                    onChange={handleInputChange}
                    placeholder="จังหวัด"
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Coordinates display */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700">พิกัด</span>
                  <span className="text-xs text-gray-400">(จิ้มบนแผนที่หรือลากหมุดเพื่อเปลี่ยน)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-2 rounded-lg border">
                    <span className="text-xs text-gray-500">ละติจูด</span>
                    <p className="font-medium text-gray-800">{formData.latitude.toFixed(6)}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border">
                    <span className="text-xs text-gray-500">ลองจิจูด</span>
                    <p className="font-medium text-gray-800">{formData.longitude.toFixed(6)}</p>
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="capacity" className="text-sm font-medium">
                    ความจุ (ลิตร)
                  </Label>
                  <Input
                    id="capacity"
                    name="capacity"
                    type="number"
                    value={formData.capacity || ''}
                    onChange={handleInputChange}
                    placeholder="100"
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="maxDistance" className="text-sm font-medium">
                    ระยะวัดสูงสุด (ซม.)
                  </Label>
                  <Input
                    id="maxDistance"
                    name="maxDistance"
                    type="number"
                    value={formData.maxDistance || ''}
                    onChange={handleInputChange}
                    placeholder="100"
                    className="mt-1"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isLoading}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  'บันทึก'
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
