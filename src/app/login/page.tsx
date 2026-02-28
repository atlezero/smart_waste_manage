'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Lock, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                username,
                password,
                redirect: false,
            });

            if (result?.error) {
                toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            } else {
                toast.success('เข้าสู่ระบบสำเร็จ');
                router.push('/');
                router.refresh(); // Refresh layout to show auth state changes
            }
        } catch (error) {
            toast.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Dynamic Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ x: [0, 20, 0], y: [0, 30, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-100/40 blur-3xl"
                />
                <motion.div
                    animate={{ x: [0, -20, 0], y: [0, -30, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-[60%] left-[70%] w-[35%] h-[35%] rounded-full bg-green-100/40 blur-3xl"
                />
                <motion.div
                    animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.4, 0.3] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-[30%] left-[40%] w-[20%] h-[20%] rounded-full bg-yellow-100/30 blur-2xl"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="sm:mx-auto sm:w-full sm:max-w-md z-10"
            >
                <div className="text-center mb-10">
                    <div className="mx-auto h-20 w-20 bg-white rounded-2xl shadow-xl shadow-gray-200/50 flex items-center justify-center mb-6">
                        <ShieldCheck className="h-10 w-10 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        เข้าสู่ระบบ
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                        ระบบจัดการถังขยะอัจฉริยะสำหรับเทศบาล
                    </p>
                </div>

                <div className="bg-white/80 backdrop-blur-xl py-10 px-6 sm:rounded-2xl sm:px-10 shadow-2xl shadow-gray-200/50 border border-gray-100">
                    <form className="mb-0 space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                ชื่อผู้ใช้งาน
                            </label>
                            <div className="mt-2 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400" />
                                </div>
                                <Input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="pl-10 py-6 bg-white/50 border-gray-200 focus:bg-white transition-colors"
                                    placeholder="admin"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                รห้สผ่าน
                            </label>
                            <div className="mt-2 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 py-6 bg-white/50 border-gray-200 focus:bg-white transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-6 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all hover:shadow-lg hover:-translate-y-0.5"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                                        กำลังตรวจสอบ...
                                    </>
                                ) : (
                                    'เข้าสู่ระบบ'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                <div className="mt-8 text-center text-sm text-gray-600 space-y-2">
                    <p>
                        ยังไม่มีบัญชีผู้ใช้?{' '}
                        <button
                            type="button"
                            onClick={() => router.push('/register')}
                            className="font-medium text-green-600 hover:text-green-500 transition-colors"
                        >
                            ลงทะเบียนที่นี่
                        </button>
                    </p>
                    <p className="text-xs text-gray-400 mt-4">หากคุณลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ</p>
                    <p className="text-xs text-gray-400">© {new Date().getFullYear()} เทศบาลเมือง</p>
                </div>
            </motion.div>
        </div>
    );
}
