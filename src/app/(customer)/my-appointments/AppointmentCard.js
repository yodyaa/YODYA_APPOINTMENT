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
            <div className="bg-primary p-5 text-white flex flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    {/* รูปภาพบริการ: fallback ไป workorderInfo.imageUrl */}
                    {(job.serviceInfo?.imageUrl || job.workorderInfo?.imageUrl) && (
                        <img
                            src={job.serviceInfo?.imageUrl || job.workorderInfo?.imageUrl}
                            alt={job.serviceInfo?.name || job.workorderInfo?.workorder || "Service"}
                            className="w-20 h-20 object-cover rounded-lg border-2 border-white shadow-md bg-white"
                        />
                    )}
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
                </div>
                <div className="flex flex-col items-end mt-4 md:mt-0">
                    <div className="text-sm font-bold px-2 py-1 rounded-full bg-white/20 border border-white/30 shadow-sm">
                        {statusInfo.text}
                    </div>
                </div>
            </div>
            {job.status === 'confirmed' && (
                <div className="p-5">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm mb-2">
                        <div className="font-semibold text-gray-700">เคสที่</div>
                        <div className="text-gray-900">{job.caseNumber ?? job.workorderInfo?.caseNumber ?? '-'}</div>
                        <div className="font-semibold text-gray-700">บริการ</div>
                        <div className="text-gray-900">
                            {/* รองรับบริการหลายรายการ และ fallback ไป workorderInfo */}
                            {Array.isArray(job.serviceInfo)
                                ? job.serviceInfo.map(s => s.name).filter(Boolean).join(', ')
                                : job.serviceInfo?.name
                                    || job.workorderInfo?.workorder
                                    || (job.appointmentInfo?.addOns?.length > 0
                                        ? job.appointmentInfo.addOns.map(a => a.name).filter(Boolean).join(', ')
                                        : '-')}
                        </div>
                        <div className="font-semibold text-gray-700">ราคา (บาท)</div>
                        <div className="text-gray-900">
                            {(() => {
                                // ลำดับ fallback: workorderInfo.price > paymentInfo.basePrice > paymentInfo.totalPrice > serviceInfo.price + addOns
                                let price = job.workorderInfo?.price;
                                if (price === undefined || price === null || price === '') price = job.paymentInfo?.basePrice;
                                if (price === undefined || price === null || price === '') price = job.paymentInfo?.totalPrice;
                                if ((price === undefined || price === null || price === '') && job.serviceInfo?.price !== undefined) price = job.serviceInfo.price;
                                // ถ้า addOns มีราคา ให้รวมเพิ่ม
                                if ((price === undefined || price === null || price === '') && Array.isArray(job.serviceInfo?.addOns)) {
                                    price = job.serviceInfo.addOns.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);
                                }
                                // ถ้า price เป็น string ให้แปลงเป็น number
                                const priceNum = typeof price === 'string' ? Number(price) : price;
                                return !isNaN(priceNum) && priceNum !== undefined && priceNum !== null
                                    ? priceNum.toLocaleString()
                                    : '0';
                            })()}
                        </div>
                        <div className="font-semibold text-gray-700">สถานะเก็บเงิน</div>
                        <div className="text-gray-900">
                            {(() => {
                                // ให้ workorderInfo.paymentStatus realtime มาก่อน
                                const status = job.workorderInfo?.paymentStatus ?? job.paymentInfo?.status ?? job.paymentInfo?.paymentStatus ?? job.paymentStatus ?? '-';
                                switch (status) {
                                    case 'unpaid': return 'ค้างชำระ';
                                    case 'paid': return 'ชำระแล้ว';
                                    case 'pending': return 'รอชำระเงิน';
                                    case 'partial': return 'ชำระบางส่วน';
                                    case 'cancelled': return 'ยกเลิก';
                                    case '-': return 'ไม่พบข้อมูล';
                                    default: return status;
                                }
                            })()}
                        </div>
                        <div className="font-semibold text-gray-700">ช่าง</div>
                        <div className="text-gray-900">
                            {job.workorderInfo?.beauticianName
                                || job.workorderInfo?.responsible
                                || job.beauticianInfo?.name
                                || job.beauticianInfo?.firstName
                                || job.beauticianInfo?.displayName
                                || job.beautician
                                || job.beauticianName
                                || job.serviceInfo?.beautician
                                || job.serviceInfo?.beauticianName
                                || '-'}
                        </div>
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
