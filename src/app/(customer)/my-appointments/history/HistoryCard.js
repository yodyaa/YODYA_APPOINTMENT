"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

const statusConfig = {
    'completed': { text: 'เสร็จสมบูรณ์', color: 'bg-green-100 text-green-800' },
    'cancelled': { text: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
};

const HistoryCard = ({ appointment, onBookAgain }) => {
    const { profile } = useProfile();
    // Always log all appointment props for debugging
    console.log('HistoryCard ALL appointment props:', appointment);
    const appointmentDateTime = appointment.appointmentInfo?.dateTime?.toDate ? appointment.appointmentInfo.dateTime.toDate() : null;
    const statusInfo = statusConfig[appointment.status] || { text: appointment.status, color: 'bg-gray-100 text-gray-800' };
    const addOns = appointment.appointmentInfo?.addOns || [];
    // Debug log for all possible sources
    console.log('HistoryCard debug:', {
        workorderInfo: appointment.workorderInfo,
        appointmentInfo: appointment.appointmentInfo,
        beauticianInfo: appointment.beauticianInfo,
        serviceInfo: appointment.serviceInfo,
        paymentInfo: appointment.paymentInfo,
    });
    // ชื่อช่าง (staff)
    const staffName = appointment.workorderInfo?.beauticianName
        || appointment.workorderInfo?.responsible
        || appointment.beauticianInfo?.name
        || appointment.beauticianInfo?.firstName
        || appointment.beauticianInfo?.displayName
        || appointment.beautician
        || appointment.beauticianName
        || appointment.serviceInfo?.beautician
        || appointment.serviceInfo?.beauticianName
        || '-';
    // ราคา
    let price = appointment.workorderInfo?.price;
    if (price === undefined || price === null || price === '') price = appointment.paymentInfo?.basePrice;
    if (price === undefined || price === null || price === '') price = appointment.paymentInfo?.totalPrice;
    if ((price === undefined || price === null || price === '') && appointment.serviceInfo?.price !== undefined) price = appointment.serviceInfo.price;
    if ((price === undefined || price === null || price === '') && Array.isArray(appointment.serviceInfo?.addOns)) {
        price = appointment.serviceInfo.addOns.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);
    }
    const priceNum = typeof price === 'string' ? Number(price) : price;
    // ที่อยู่
    const address = appointment.workorderInfo?.address
        || appointment.appointmentInfo?.address
        || appointment.serviceInfo?.address
        || '-';
    // Log what is actually used
    console.log('HistoryCard selected:', {
        staffName,
        priceNum,
        address,
    });
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all">
            <div className="p-5">
                <div className="flex flex-row justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="text-xs opacity-80 mb-1 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full"></span>
                            <span className="truncate">ประวัติการใช้บริการ</span>
                        </div>
                        <div className="font-bold text-base leading-tight text-gray-800">
                            {appointment.serviceInfo?.name || appointment.workorderInfo?.workorder || '-'}
                        </div>
                        <div className="font-semibold text-sm text-gray-500 mt-0.5">
                            {appointmentDateTime ? format(appointmentDateTime, 'dd MMM yyyy', { locale: th }) : '-'}
                        </div>
                        <div className="font-semibold text-sm text-gray-500">
                            {appointmentDateTime ? format(appointmentDateTime, 'HH:mm น.', { locale: th }) : '-'}
                        </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                        <div className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusInfo.color} border border-gray-300 shadow-sm whitespace-nowrap`}>
                            {statusInfo.text}
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-5">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm mb-2">
                    <div className="font-semibold text-gray-700">เคสที่</div>
                    <div className="text-gray-900">{appointment.caseNumber ?? appointment.workorderInfo?.caseNumber ?? '-'}</div>
                    <div className="font-semibold text-gray-700">บริการ</div>
                    <div className="text-gray-900">
                        {Array.isArray(appointment.serviceInfo)
                            ? appointment.serviceInfo.map(s => s.name).filter(Boolean).join(', ')
                            : appointment.serviceInfo?.name
                            || appointment.workorderInfo?.workorder
                            || (appointment.appointmentInfo?.addOns?.length > 0
                                ? appointment.appointmentInfo.addOns.map(a => a.name).filter(Boolean).join(', ')
                                : '-')}
                    </div>
                    <div className="font-semibold text-gray-700">ราคา (บาท)</div>
                    <div className="text-gray-900">{!isNaN(priceNum) && priceNum !== undefined && priceNum !== null ? priceNum.toLocaleString() : '0'} {profile?.currencySymbol}</div>
                    <div className="font-semibold text-gray-700">สถานะเก็บเงิน</div>
                    <div className="text-gray-900">
                        {(() => {
                            const status = appointment.workorderInfo?.paymentStatus ?? appointment.paymentInfo?.status ?? appointment.paymentInfo?.paymentStatus ?? appointment.paymentStatus ?? '-';
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
                    <div className="text-gray-900">{staffName}</div>
                    <div className="font-semibold text-gray-700">ที่อยู่</div>
                    <div className="text-gray-900">{address}</div>
                </div>
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
                {onBookAgain && (
                    <div className="pt-2 text-right">
                        <button className="text-primary font-semibold text-xs underline" onClick={() => onBookAgain(appointment)}>
                            จองซ้ำ
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryCard;