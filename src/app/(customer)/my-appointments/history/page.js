"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import HistoryCard from './HistoryCard'; // Import the new component
import CustomerHeader from '@/app/components/CustomerHeader';

export default function BookingHistoryPage() {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const [historyBookings, setHistoryBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (liffLoading || !profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }

        setLoading(true);
        
        // ใช้ onSnapshot เพื่อ realtime updates
        const bookingsQuery = query(
            collection(db, 'appointments'),
            where("userId", "==", profile.userId),
            where("status", "in", ["completed", "cancelled"]),
            orderBy("appointmentInfo.dateTime", "desc")
        );
        
        const unsubscribe = onSnapshot(
            bookingsQuery,
            (querySnapshot) => {
                const bookingsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHistoryBookings(bookingsData);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching booking history:", error);
                setLoading(false);
            }
        );

        // Cleanup listener เมื่อ component unmount
        return () => unsubscribe();
    }, [profile, liffLoading]);

    const handleBookAgain = () => {
        router.push('/appointment');
    };

    if (liffLoading) {
        return <div className="p-4 text-center">Initializing LIFF...</div>;
    }

    if (liffError) {
        return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;
    }

    return (
        <div>
            <CustomerHeader showBackButton={false} showActionButtons={true} />
            <div className="px-4 pb-4 space-y-5">
                <main className="space-y-5">
                    {loading ? (
                        <div className="text-center text-gray-500 pt-10">กำลังโหลดประวัติ...</div>
                    ) : historyBookings.length === 0 ? (
                        <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-2xl shadow">
                            <p>ยังไม่มีประวัติการใช้บริการ</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {historyBookings.map(job => {
                                console.log('BookingHistoryPage appointment:', job);
                                return (
                                    <HistoryCard
                                        key={job.id}
                                        appointment={job}
                                        onBookAgain={handleBookAgain}
                                    />
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}