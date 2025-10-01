// src/app/(customer)/my-appointments/page.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { cancelAppointmentByUser, confirmAppointmentByUser } from '@/app/actions/appointmentActions'; // Import new action
import AppointmentCard from './AppointmentCard';
import QrCodeModal from '@/app/components/common/QrCodeModal';
import CustomerHeader from '@/app/components/CustomerHeader';

export default function MyAppointmentsPage() {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
    const [appointmentToCancel, setAppointmentToCancel] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => setNotification({ ...notification, show: false }), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (liffLoading || !profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }
        setLoading(true);
        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where("userId", "==", profile.userId),
            where("status", "in", ['awaiting_confirmation', 'confirmed', 'in_progress']),
            orderBy("appointmentInfo.dateTime", "asc")
        );
        let workordersUnsub = null;
        const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const bookingIds = docs.map(d => d.id);
            if (workordersUnsub) workordersUnsub();
            if (bookingIds.length === 0) {
                setAppointments(docs);
                setLoading(false);
                return;
            }
            const workordersQuery = query(
                collection(db, 'workorders'),
                where('bookingId', 'in', bookingIds)
            );
            workordersUnsub = onSnapshot(workordersQuery, (workordersSnap) => {
                const workorders = workordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const workorderMap = {};
                workorders.forEach(w => { workorderMap[w.bookingId] = w; });
                const merged = docs.map(job => ({ ...job, workorderInfo: workorderMap[job.id] || undefined }));
                setAppointments(merged);
                setLoading(false);
            });
        }, (error) => {
            console.error("Error fetching appointments:", error);
            setNotification({ show: true, title: 'Error', message: 'Could not fetch appointments.', type: 'error' });
            setLoading(false);
        });
        return () => {
            unsubscribe();
            if (workordersUnsub) workordersUnsub();
        };
    }, [profile, liffLoading]);

    const handleQrCodeClick = (appointmentId) => {
        setSelectedAppointmentId(appointmentId);
        setShowQrModal(true);
    };

    const handleCancelClick = (appointment) => {
        setAppointmentToCancel(appointment);
    };

    const confirmCancelAppointment = async () => {
        if (!appointmentToCancel || !profile?.userId) return;
        setIsCancelling(true);
        const result = await cancelAppointmentByUser(appointmentToCancel.id, profile.userId);

        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'การนัดหมายของคุณถูกยกเลิกแล้ว', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsCancelling(false);
        setAppointmentToCancel(null);
    };

    const handleConfirmClick = async (appointment) => {
        if (!profile?.userId) return;
        setIsConfirming(true);
        const result = await confirmAppointmentByUser(appointment.id, profile.userId);
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยืนยันการนัดหมายเรียบร้อย', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsConfirming(false);
    };


    if (liffLoading) return <div className="p-4 text-center">รอสักครู่...</div>;
    if (liffError) return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;

    return (
        <div>
            <CustomerHeader showBackButton={false} showActionButtons={true} />
            <div className="px-4 pb-4 space-y-5">
            <Notification {...notification} />
            <ConfirmationModal
                show={!!appointmentToCancel}
                title="ยืนยันการยกเลิก"
                message={`คุณต้องการยกเลิกการนัดหมายบริการ ${appointmentToCancel?.serviceInfo.name} ใช่หรือไม่?`}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setAppointmentToCancel(null)}
                isProcessing={isCancelling}
            />
            <QrCodeModal
                show={showQrModal}
                onClose={() => setShowQrModal(false)}
                appointmentId={selectedAppointmentId}
            />
            
            <div className="py-4 space-y-4">
                <div className="font-bold text-md text-gray-700">นัดหมายของฉัน</div>
                {loading ? (
                    <div className="text-center text-gray-500 pt-10">กำลังโหลดรายการนัดหมาย...</div>
                ) : appointments.length === 0 ? (
                    <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-xl shadow-sm">
                        <p className="font-semibold">ไม่มีรายการนัดหมายที่กำลังดำเนินอยู่</p>
                    </div>
                ) : (
                    appointments.map((job) => (
                        <AppointmentCard
                            key={job.id}
                            job={job}
                            onQrCodeClick={handleQrCodeClick}
                            onCancelClick={handleCancelClick}
                            onConfirmClick={handleConfirmClick}
                            isConfirming={isConfirming}
                        />
                    ))
                )}
            </div>
            </div>
        </div>
    );
}