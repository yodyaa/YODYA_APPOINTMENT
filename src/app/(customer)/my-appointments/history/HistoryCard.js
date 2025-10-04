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
    const appointmentDateTime = appointment.appointmentInfo.dateTime.toDate();
    const statusInfo = statusConfig[appointment.status] || { text: appointment.status, color: 'bg-gray-100 text-gray-800' };
    const addOns = appointment.appointmentInfo?.addOns || [];
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
    return (
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-bold text-gray-800 text-base">
                        {appointment.serviceInfo?.name || appointment.workorderInfo?.workorder || '-'}
                    </div>
                    <div className="text-xs text-gray-500">
                        {format(appointmentDateTime, 'dd MMM yyyy', { locale: th })} {format(appointmentDateTime, 'HH:mm น.', { locale: th })}
                    </div>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                    {statusInfo.text}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs mt-1">
                <div className="font-medium text-gray-600">ราคา</div>
                <div className="text-gray-900">{!isNaN(priceNum) && priceNum !== undefined && priceNum !== null ? priceNum.toLocaleString() : '0'} {profile?.currencySymbol}</div>
                <div className="font-medium text-gray-600">ช่าง</div>
                <div className="text-gray-900">{staffName}</div>
                {addOns.length > 0 && <><div className="font-medium text-gray-600">บริการเสริม</div><div className="text-gray-900">{addOns.map(a => a.name).join(', ')}</div></>}
            </div>
            {onBookAgain && (
                <div className="pt-2 text-right">
                    <button className="text-primary font-semibold text-xs underline" onClick={() => onBookAgain(appointment)}>
                        จองซ้ำ
                    </button>
                </div>
            )}
        </div>
    );
};

export default HistoryCard;