'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Copy, Check, RefreshCw, Loader2, ArrowLeft, Trash2, Shield, Eye, EyeOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';

interface ApiKeyItem {
    id: string;
    apiKey: string;
    name: string;
    address: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export default function ApiKeysPage() {
    const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const fetchApiKeys = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/api-keys');
            const data = await response.json();
            if (data.success) {
                setApiKeys(data.data);
            } else {
                toast.error('ไม่สามารถโหลดข้อมูล API Keys ได้');
            }
        } catch (error) {
            console.error('Failed to fetch API Keys:', error);
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    const handleCopyKey = async (apiKey: string, binId: string) => {
        try {
            await navigator.clipboard.writeText(apiKey);
            setCopiedId(binId);
            toast.success('คัดลอก API Key เรียบร้อย');
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            toast.error('ไม่สามารถคัดลอกได้');
        }
    };

    const handleRegenerateKey = async (binId: string, binName: string) => {
        if (!confirm(`ต้องการสร้าง API Key ใหม่สำหรับ "${binName}" ใช่หรือไม่?\n\n⚠️ API Key เดิมจะใช้ไม่ได้อีกต่อไป อุปกรณ์ IoT จะต้องอัปเดต Key ใหม่`)) {
            return;
        }

        setRegeneratingId(binId);
        try {
            const response = await fetch('/api/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ binId }),
            });
            const data = await response.json();
            if (data.success) {
                // อัปเดต key ใน state
                setApiKeys(prev => prev.map(item =>
                    item.id === binId
                        ? { ...item, apiKey: data.data.apiKey, updatedAt: new Date().toISOString() }
                        : item
                ));
                // แสดง key ใหม่ให้เห็น
                setVisibleKeys(prev => new Set([...prev, binId]));
                toast.success(`สร้าง API Key ใหม่สำเร็จสำหรับ "${binName}"`);
            } else {
                toast.error(data.error || 'ไม่สามารถสร้าง API Key ใหม่ได้');
            }
        } catch (error) {
            console.error('Failed to regenerate API Key:', error);
            toast.error('เกิดข้อผิดพลาดในการสร้าง API Key ใหม่');
        } finally {
            setRegeneratingId(null);
        }
    };

    const toggleKeyVisibility = (binId: string) => {
        setVisibleKeys(prev => {
            const next = new Set(prev);
            if (next.has(binId)) {
                next.delete(binId);
            } else {
                next.add(binId);
            }
            return next;
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const maskKey = (key: string) => {
        if (key.length <= 12) return key;
        return key.substring(0, 8) + '••••••••••••••••' + key.substring(key.length - 4);
    };

    const filteredKeys = apiKeys.filter(item => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            item.name.toLowerCase().includes(query) ||
            item.address.toLowerCase().includes(query) ||
            item.apiKey.toLowerCase().includes(query)
        );
    });

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button variant="ghost" size="sm" className="rounded-xl hover:bg-gray-100">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    กลับ
                                </Button>
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                                    <Key className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">จัดการ API Keys</h1>
                                    <p className="text-sm text-gray-500">สร้างและจัดการ API Keys สำหรับถังขยะ IoT</p>
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={fetchApiKeys}
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            disabled={isLoading}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            รีเฟรช
                        </Button>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Info Banner */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 rounded-2xl p-5 mb-8"
                >
                    <div className="flex items-start gap-3">
                        <Shield className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-1">ข้อมูลสำคัญเกี่ยวกับ API Keys</h3>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• API Key ใช้สำหรับระบุตัวตนของถังขยะ IoT เมื่อส่งข้อมูล sensor</li>
                                <li>• แต่ละถังขยะจะมี API Key เป็นของตัวเอง ถูกสร้างอัตโนมัติเมื่อเพิ่มถังขยะ</li>
                                <li>• ใช้ API Key ใน header หรือ body ของ request เมื่อส่งข้อมูลจาก IoT device</li>
                                <li>• หากต้องการเปลี่ยน API Key สามารถกด &quot;สร้างใหม่&quot; ได้ แต่ Key เดิมจะใช้ไม่ได้</li>
                            </ul>
                        </div>
                    </div>
                </motion.div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="ค้นหา ชื่อถังขยะ, ที่อยู่..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 bg-white rounded-xl shadow-sm border-gray-200/50 text-base"
                    />
                </div>

                {/* API Keys Count */}
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">
                        ทั้งหมด <span className="font-semibold text-gray-800">{filteredKeys.length}</span> รายการ
                    </p>
                </div>

                {/* Loading */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <Loader2 className="w-10 h-10 mx-auto mb-4 text-blue-500 animate-spin" />
                            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                        </div>
                    </div>
                ) : filteredKeys.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <Key className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-600 mb-2">ไม่พบ API Keys</h3>
                        <p className="text-gray-400 mb-6">
                            {searchQuery ? 'ลองเปลี่ยนคำค้นหา' : 'เพิ่มถังขยะใหม่เพื่อสร้าง API Key'}
                        </p>
                        <Link href="/">
                            <Button className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl">
                                <Trash2 className="w-4 h-4 mr-2" />
                                ไปหน้าเพิ่มถังขยะ
                            </Button>
                        </Link>
                    </motion.div>
                ) : (
                    /* API Keys List */
                    <div className="space-y-4">
                        <AnimatePresence>
                            {filteredKeys.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden"
                                >
                                    <div className="p-5">
                                        {/* Top Row - Bin Info */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-yellow-100 p-2.5 rounded-xl">
                                                    <Trash2 className="w-5 h-5 text-yellow-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                                    <p className="text-sm text-gray-500">{item.address}</p>
                                                </div>
                                            </div>
                                            <Badge variant={item.isActive ? 'default' : 'secondary'} className={item.isActive ? 'bg-green-500' : ''}>
                                                {item.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                                            </Badge>
                                        </div>

                                        {/* API Key Row */}
                                        <div className="bg-gray-50 rounded-xl p-4 mb-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <Key className="w-3 h-3" />
                                                    API Key
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded-lg border border-gray-200 text-gray-800 overflow-x-auto">
                                                    {visibleKeys.has(item.id) ? item.apiKey : maskKey(item.apiKey)}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleKeyVisibility(item.id)}
                                                    className="flex-shrink-0 rounded-lg hover:bg-gray-200"
                                                    title={visibleKeys.has(item.id) ? 'ซ่อน' : 'แสดง'}
                                                >
                                                    {visibleKeys.has(item.id) ? (
                                                        <EyeOff className="w-4 h-4 text-gray-500" />
                                                    ) : (
                                                        <Eye className="w-4 h-4 text-gray-500" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleCopyKey(item.apiKey, item.id)}
                                                    className="flex-shrink-0 rounded-lg hover:bg-blue-50"
                                                    title="คัดลอก"
                                                >
                                                    {copiedId === item.id ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-4 h-4 text-blue-500" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Bottom Row */}
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs text-gray-400 space-y-0.5">
                                                <p>สร้างเมื่อ: {formatDate(item.createdAt)}</p>
                                                <p>อัปเดตล่าสุด: {formatDate(item.updatedAt)}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRegenerateKey(item.id, item.name)}
                                                disabled={regeneratingId === item.id}
                                                className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
                                            >
                                                {regeneratingId === item.id ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        กำลังสร้าง...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 mr-2" />
                                                        สร้าง Key ใหม่
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* Usage Example */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            ตัวอย่างการใช้งาน API Key
                        </h3>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-gray-600 mb-4">
                            ส่งข้อมูล sensor จากอุปกรณ์ IoT โดยใส่ API Key ใน body ของ request:
                        </p>
                        <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                            <pre className="text-sm text-gray-300 font-mono whitespace-pre">
                                {`POST /api/sensor
Content-Type: application/json

{
  "apiKey": "swm_your_api_key_here",
  "distanceCm": 25.5,
  "lightLevel": 350,
  "lightStatus": true,
  "temperature": 28.5,
  "humidity": 65.0
}`}
                            </pre>
                        </div>
                        <p className="text-xs text-gray-400 mt-3">
                            💡 Tip: ใช้ distanceCm แทน wasteLevel เพื่อให้ระบบคำนวณเปอร์เซ็นต์ขยะอัตโนมัติ
                        </p>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
