"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';

export default function AppointmentPage() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const router = useRouter();
    const { profile } = useProfile();

    const fetchServices = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const servicesRef = collection(db, 'services');
            // Try ordering by serviceName first, as it's more logical for display
            const q = query(servicesRef, orderBy('serviceName'));
            const querySnapshot = await getDocs(q);

            let items = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Fallback if the ordered query fails or returns nothing
            if (items.length === 0) {
                const fallbackSnapshot = await getDocs(servicesRef);
                items = fallbackSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // กรองเฉพาะบริการที่เปิดให้บริการ (status === 'available')
            items = items.filter(item => item.status === 'available');

            // เรียงลำดับ: รายการยอดนิยม (isFavorite) ก่อน แล้วตามด้วยชื่อบริการ
            items.sort((a, b) => {
                // ถ้า a เป็นรายการยอดนิยม แต่ b ไม่ใช่ ให้ a อยู่ข้างหน้า
                if (a.isFavorite && !b.isFavorite) return -1;
                // ถ้า b เป็นรายการยอดนิยม แต่ a ไม่ใช่ ให้ b อยู่ข้างหน้า
                if (!a.isFavorite && b.isFavorite) return 1;
                // ถ้าทั้งคู่เป็นหรือไม่เป็นรายการยอดนิยมเหมือนกัน ให้เรียงตามชื่อบริการ
                return (a.serviceName || '').localeCompare(b.serviceName || '', 'th');
            });

            setServices(items);
        } catch (e) {
            console.error('Failed fetching services', e);
            setErrorMsg('ไม่สามารถโหลดรายการบริการได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const handleSelectService = (service) => {
        router.push(`/appointment/service-detail?id=${service.id}`);
    };

    if (loading) return <div className="p-4 text-center">กำลังโหลดบริการ...</div>;
    if (errorMsg) return <div className="p-4 text-center text-red-600">{errorMsg}</div>;
    if (!loading && services.length === 0) {
        return (
            <div className="p-6 text-center bg-white rounded-xl">
                <p className="mb-4 text-gray-700">ขออภัย ขณะนี้ยังไม่มีบริการให้เลือก</p>
                <button onClick={fetchServices} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold">ลองอีกครั้ง</button>
            </div>
        );
    }

    return (
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="p-4">
                {/* แสดงหัวข้อ "ยอดนิยม" ถ้ามีรายการยอดนิยม */}
                {services.filter(s => s.isFavorite).length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg font-bold text-gray-800">🔥 ยอดนิยม</span>
                            <span className="text-xs text-gray-500">({services.filter(s => s.isFavorite).length} บริการ)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {services
                                .filter(service => service.isFavorite)
                                .map(service => (
                                    <div
                                        key={service.id}
                                        onClick={() => handleSelectService(service)}
                                        className="rounded-xl overflow-hidden shadow-md cursor-pointer bg-white hover:shadow-xl transition-all border  border-green-600 relative"
                                    >
                                        {/* Badge ยอดนิยม */}
                                        <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full px-2 py-1 text-xs   shadow-lg z-10 flex items-center gap-1">
                                            🔥 <span>ยอดนิยม</span>
                                        </div>
                                        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                                            <Image
                                                src={service.imageUrl || 'https://via.placeholder.com/300'}
                                                alt={service.serviceName}
                                                fill
                                                className="object-cover w-full h-full"
                                                priority
                                            />
                                        </div>
                                        <div className="px-3 py-3 bg-gradient-to-br from-yellow-50 to-white">
                                            <div className="text-gray-800 font-semibold text-sm text-center leading-tight">
                                                {service.serviceName}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* แสดงหัวข้อ "บริการทั้งหมด" ถ้ามีบริการที่ไม่ใช่ยอดนิยม */}
                {services.filter(s => !s.isFavorite).length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg font-bold text-gray-800">📋 บริการทั้งหมด</span>
                            <span className="text-xs text-gray-500">({services.filter(s => !s.isFavorite).length} บริการ)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {services
                                .filter(service => !service.isFavorite)
                                .map(service => (
                                    <div
                                        key={service.id}
                                        onClick={() => handleSelectService(service)}
                                        className="rounded-xl overflow-hidden shadow-md cursor-pointer bg-white hover:shadow-xl transition-all border border-gray-200"
                                    >
                                        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                                            <Image
                                                src={service.imageUrl || 'https://via.placeholder.com/300'}
                                                alt={service.serviceName}
                                                fill
                                                className="object-cover w-full h-full"
                                                priority
                                            />
                                        </div>
                                        <div className="px-3 py-3 bg-white">
                                            <div className="text-gray-800 font-semibold text-sm text-center leading-tight">
                                                {service.serviceName}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}