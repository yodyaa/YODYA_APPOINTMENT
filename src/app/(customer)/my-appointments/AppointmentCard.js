// src/app/(customer)/my-appointments/AppointmentCard.js
"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '../../../context/ProfileProvider';

const AppointmentCard = ({ job, onQrCodeClick, onCancelClick, onConfirmClick, isConfirming }) => {
    const { profile } = useProfile();
    const statusInfo = {
        'awaiting_confirmation': { text: 'รอยืนยัน' },
        'confirmed': { text: 'ยืนยันแล้ว' },
        'in_progress': { text: 'กำลังใช้บริการ' },
    }[job.status] || { text: job.status };

    const appointmentDateTime = job.appointmentInfo.dateTime.toDate();
    const addOns = job.appointmentInfo?.addOns || [];

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all hover:shadow-xl">
            <div className="bg-primary p-5 text-white flex justify-between items-center">
                <div>
                    <div className="text-xs opacity-80 mb-1 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                        นัดหมายบริการ
                    </div>
                    <div className="font-bold text-lg tracking-wide text-white/80">{format(appointmentDateTime, 'dd MMM yyyy, HH:mm น.', { locale: th })}</div>
                    {job.status === 'awaiting_confirmation' && (
                        <div className="text-xs text-white/60 mt-1">บริการที่จอง: {job.serviceInfo?.name || '-'}</div>
                    )}
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-base font-bold px-3 py-1 rounded-full bg-white/20 border border-white/30 shadow-sm">
                        {statusInfo.text}
                    </div>
                </div>
            </div>
            {job.status === 'confirmed' && (
                <div className="p-5">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm mb-2">
                        <div className="font-semibold text-gray-700">เคสที่</div>
                        <div className="text-gray-900">{job.caseNumber || '-'}</div>
                        <div className="font-semibold text-gray-700">บริการ</div>
                        <div className="text-gray-900">{job.serviceInfo?.name || '-'}</div>
                        <div className="font-semibold text-gray-700">ราคา (บาท)</div>
                        <div className="text-gray-900">{job.paymentInfo?.basePrice?.toLocaleString() || job.workorderInfo?.price?.toLocaleString() || '-'}</div>
                        <div className="font-semibold text-gray-700">สถานะเก็บเงิน</div>
                        <div className="text-gray-900">{job.paymentInfo?.status || '-'}</div>
                        <div className="font-semibold text-gray-700">ช่าง</div>
                        <div className="text-gray-900">{job.beauticianInfo?.name || job.workorderInfo?.beauticianName || '-'}</div>
                    </div>
                </div>
            )}
            {addOns.length > 0 && (
                <div className="space-y-1 text-sm text-gray-600 mb-3 pl-6 border-l-4 border-primary">
                    {addOns.map((addon, index) => (
                        <div key={index} className="flex justify-between">
                            <span>+ {addon.name}</span>
                            <span>{addon.price?.toLocaleString()} {profile?.currencySymbol}</span>
                        </div>
                    ))}
                </div>
            )}
            {/* ลบส่วนราคารวมออก */}
            {/* ลบปุ่ม QR Code และข้อความรอการยืนยันข้อมูลออก */}
            {job.status === 'awaiting_confirmation' && job.createdAt && (
                <div className="w-full text-center pb-2">
                    <span className="text-xs text-gray-400">วันที่สร้างการจอง: {format(job.createdAt.toDate ? job.createdAt.toDate() : job.createdAt, 'dd MMM yyyy, HH:mm น.', { locale: th })}</span>
                </div>
            )}
        </div>
    );
};

export default AppointmentCard;
