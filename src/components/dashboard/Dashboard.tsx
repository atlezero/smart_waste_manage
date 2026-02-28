'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Lightbulb, TrendingUp, MapPin, Clock, AlertTriangle, CheckCircle, AlertCircle, WifiOff, Wifi } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore, Bin } from '@/store/app-store';

// Get gradient color from green to yellow to red based on waste level
const getGradientColor = (level: number): string => {
  const clampedLevel = Math.max(0, Math.min(100, level));

  let r: number, g: number, b: number;

  if (clampedLevel <= 50) {
    const t = clampedLevel / 50;
    r = Math.round(34 + (245 - 34) * t);
    g = Math.round(197 + (158 - 197) * t);
    b = Math.round(94 + (11 - 94) * t);
  } else {
    const t = (clampedLevel - 50) / 50;
    r = Math.round(245 + (239 - 245) * t);
    g = Math.round(158 + (68 - 158) * t);
    b = Math.round(11 + (68 - 11) * t);
  }

  return `rgb(${r}, ${g}, ${b})`;
};

interface DashboardStats {
  totalBins: number;
  lowBins: number;
  mediumBins: number;
  highBins: number;
  avgWasteLevel: number;
  activeLights: number;
  lastUpdate: string | null;
  chartData: { time: string; avgLevel: number }[];
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  delay
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
  >
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${bgColor}`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const StatusCard = ({
  title,
  count,
  total,
  color,
  bgColor,
  icon: Icon,
  delay
}: {
  title: string;
  count: number;
  total: number;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  delay: number;
}) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <span className="font-medium text-gray-700">{title}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-3xl font-bold text-gray-800">{count}</span>
              <span className="text-sm text-gray-500">{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: getGradientColor(title === 'ว่าง' ? 0 : title === 'ปานกลาง' ? 50 : 100),
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function Dashboard() {
  const { bins } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [bins]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">ไม่สามารถโหลดข้อมูลได้</p>
      </div>
    );
  }

  const formatLastUpdate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">ภาพรวมระบบ</h1>
        <p className="text-gray-500 mt-1">เทศบาลจัดการถังขยะอัจฉริยะ</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ถังขยะทั้งหมด"
          value={stats.totalBins}
          icon={Trash2}
          color="text-yellow-600"
          bgColor="bg-yellow-100"
          delay={0.1}
        />
        <StatCard
          title="ไฟเปิดอยู่"
          value={stats.activeLights}
          icon={Lightbulb}
          color="text-blue-600"
          bgColor="bg-blue-100"
          delay={0.2}
        />
        <StatCard
          title="ระดับเฉลี่ย"
          value={`${stats.avgWasteLevel.toFixed(0)}%`}
          icon={TrendingUp}
          color="text-purple-600"
          bgColor="bg-purple-100"
          delay={0.3}
        />
        <StatCard
          title="อัพเดทล่าสุด"
          value={formatLastUpdate(stats.lastUpdate)}
          icon={Clock}
          color="text-green-600"
          bgColor="bg-green-100"
          delay={0.4}
        />
      </div>

      {/* Status Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">สถานะถังขยะ</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusCard
            title="ว่าง"
            count={stats.lowBins}
            total={stats.totalBins}
            color="text-green-600"
            bgColor="bg-green-100"
            icon={CheckCircle}
            delay={0.6}
          />
          <StatusCard
            title="ปานกลาง"
            count={stats.mediumBins}
            total={stats.totalBins}
            color="text-yellow-600"
            bgColor="bg-yellow-100"
            icon={AlertCircle}
            delay={0.7}
          />
          <StatusCard
            title="เต็ม"
            count={stats.highBins}
            total={stats.totalBins}
            color="text-red-600"
            bgColor="bg-red-100"
            icon={AlertTriangle}
            delay={0.8}
          />
        </div>
      </motion.div>

      {/* Bin List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">ถังขยะที่ต้องเก็บ</h2>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {bins.filter(b => b.wasteLevel >= 80).length > 0 ? (
              <div className="divide-y">
                {bins
                  .filter(b => b.wasteLevel >= 80)
                  .sort((a, b) => b.wasteLevel - a.wasteLevel)
                  .map((bin) => (
                    <div key={bin.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-red-100">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{bin.name}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {bin.address}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-500">{bin.wasteLevel.toFixed(0)}%</div>
                          <div className="text-xs text-gray-400">{bin.address}</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-2" />
                <p>ไม่มีถังขยะที่เต็มในขณะนี้</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* All Bins Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">ถังขยะทั้งหมด</h2>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {bins.length > 0 ? (
              <div className="divide-y">
                {bins.map((bin) => (
                  <div key={bin.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${bin.wasteLevel >= 80 ? 'bg-red-100' :
                          bin.wasteLevel >= 50 ? 'bg-yellow-100' : 'bg-green-100'
                          }`}>
                          <Trash2 className={`w-4 h-4 ${bin.wasteLevel >= 80 ? 'text-red-500' :
                            bin.wasteLevel >= 50 ? 'text-yellow-500' : 'text-green-500'
                            }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-800 text-sm">{bin.name}</p>
                            {bin.lastUpdate && (Date.now() - new Date(bin.lastUpdate).getTime() <= 60000) ? (
                              <span title="ออนไลน์"><Wifi className="w-3 h-3 text-green-500" /></span>
                            ) : (
                              <span title="ออฟไลน์"><WifiOff className="w-3 h-3 text-red-500" /></span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{bin.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {bin.lightStatus && (
                          <Lightbulb className="w-4 h-4 text-yellow-400" />
                        )}
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-500 ease-out rounded-full"
                            style={{
                              width: `${bin.wasteLevel}%`,
                              backgroundColor: getGradientColor(bin.wasteLevel),
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right"
                          style={{ color: getGradientColor(bin.wasteLevel) }}>
                          {bin.wasteLevel.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Trash2 className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>ไม่มีข้อมูลถังขยะ</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
