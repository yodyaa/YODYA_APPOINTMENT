"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerHeader({ showBackButton = false, showActionButtons = true }) {
    const { profile, loading, error } = useLiffContext();
    const [customerData, setCustomerData] = useState(null);
    const router = useRouter();

    useEffect(() => {
        let unsubscribe = () => { };
        if (profile?.userId) {
            const customerRef = doc(db, "customers", profile.userId);
            unsubscribe = onSnapshot(customerRef, (doc) => {
                if (doc.exists()) {
                    setCustomerData(doc.data());
                }
            });
        }
        return () => unsubscribe();
    }, [profile]);

    if (loading || error) return null;

    return (
        <div className="bg-primary w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div className="p-4 max-w-md mx-auto">
                <header className=" pb-2 flex items-center justify-between">
                {/* ไม่แสดงปุ่มกลับ */}
                <div className="flex items-center gap-3">
                    {profile?.pictureUrl ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                            <Image src={profile.pictureUrl} width={40} height={40} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded-md bg-white/30 flex-shrink-0" />
                    )}
                    <div>
                        <p className="font-medium text-sm text-secondary opacity-90">สวัสดี</p>
                        <p className="font-bold text-secondary">{profile?.displayName ? `${profile.displayName}` : 'ผู้ใช้'}</p>
                    </div>
                </div>

            </header>

            {showActionButtons && (
                <div className=" grid grid-cols-2 gap-4 mt-2">
                    <button
                        onClick={() => router.push('/appointment')}
                        className="bg-secondary text-primary shadow-sm rounded-md py-2 font-semibold text-md hover:shadow-md transition-shadow"
                    >
                        จองบริการ
                    </button>
                    <button
                        onClick={() => router.push('/my-appointments/history')}
                        className="bg-primary-light text-primary shadow-sm rounded-md py-2 font-semibold text-md hover:shadow-md transition-shadow"
                    >
                        ประวัติ
                    </button>

                </div>
            )}
            </div>
        </div>
    );
}

