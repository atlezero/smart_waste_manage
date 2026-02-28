'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/app-store';

const WS_URL = 'ws://localhost:3001';

export function useWebSocket() {
    const updateBin = useAppStore((state) => state.updateBin);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track ว่า bin ไหน sync ค่า control ครั้งแรกแล้ว
    const syncedBinIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        let isMounted = true;

        function connect() {
            if (!isMounted) return;
            if (wsRef.current?.readyState === WebSocket.OPEN) return;

            try {
                const ws = new WebSocket(WS_URL);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log('🌐 WebSocket connected');
                    // เมื่อเชื่อมต่อใหม่ ให้ reset sync เพื่อรับค่า control จาก ESP32 ครั้งแรก
                    syncedBinIds.current.clear();
                };

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'bin_update' && message.data) {
                            const incoming = message.data;
                            const currentBins = useAppStore.getState().bins;
                            const currentBin = currentBins.find((b) => b.id === incoming.id);

                            if (!currentBin) {
                                // ถังใหม่ → ใช้ข้อมูลทั้งหมด
                                updateBin(incoming);
                                return;
                            }

                            const isFirstSync = !syncedBinIds.current.has(incoming.id);

                            if (isFirstSync) {
                                // ครั้งแรก: sync ทุกค่าจาก ESP32 รวม control
                                // เพื่อให้ default ตรงกันระหว่าง ESP32 กับ Dashboard
                                syncedBinIds.current.add(incoming.id);
                                console.log(`🔄 First sync "${incoming.name}" — all fields`);
                                updateBin({
                                    ...currentBin,
                                    ...incoming,
                                });
                            } else {
                                // ครั้งถัดไป: อัพเดตเฉพาะค่าเซนเซอร์ ไม่ทับค่าควบคุม
                                updateBin({
                                    ...currentBin,
                                    wasteLevel: incoming.wasteLevel ?? currentBin.wasteLevel,
                                    lightLevel: incoming.lightLevel ?? currentBin.lightLevel,
                                    temperature: incoming.temperature ?? currentBin.temperature,
                                    humidity: incoming.humidity ?? currentBin.humidity,
                                    lastUpdate: incoming.lastUpdate ?? currentBin.lastUpdate,
                                    updatedAt: incoming.updatedAt ?? currentBin.updatedAt,
                                });
                            }
                        }
                    } catch (err) {
                        console.error('WS parse error:', err);
                    }
                };

                ws.onclose = () => {
                    console.log('🔌 WebSocket disconnected, reconnecting in 3s...');
                    wsRef.current = null;
                    if (isMounted) {
                        reconnectTimeoutRef.current = setTimeout(connect, 3000);
                    }
                };

                ws.onerror = () => {
                    ws.close();
                };
            } catch (err) {
                console.error('WebSocket connect error:', err);
                if (isMounted) {
                    reconnectTimeoutRef.current = setTimeout(connect, 3000);
                }
            }
        }

        connect();

        return () => {
            isMounted = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [updateBin]);

    return wsRef;
}
