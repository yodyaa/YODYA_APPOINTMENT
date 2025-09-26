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
                {showBackButton && (
                    <button onClick={() => router.back()} className="text-secondary text-lg font-bold">
                        ← กลับ
                    </button>
                )}
                <div className={`flex items-center gap-3 ${showBackButton ? 'ml-auto' : ''}`}>
                    {profile?.pictureUrl ? (
                        <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
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
                <div className="flex items-center gap-2 hidden">
                    <div className="bg-primary rounded-full px-6 py-2 text-white font-bold text-md">
                        {customerData?.points ?? 0} <span className="font-normal">พ้อย</span>
                    </div>
                </div>
            </header>

            {showActionButtons && (
                <div className=" grid grid-cols-2 gap-4">
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
