"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { useToast } from '@/app/components/Toast';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import { findOrCreateCustomer } from '@/app/actions/customerActions';
import { useProfile } from '@/context/ProfileProvider';
import BeauticianCard from '@/app/components/admin/BeauticianCard';
import TimeSlotGrid from '@/app/components/admin/TimeSlotGrid';

export default function CreateAppointmentPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    // State for form data
    const [customerInfo, setCustomerInfo] = useState({
        fullName: '',
        phone: '',
        address: '',
        note: '',
        lineUserId: ''
    });
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedAddOnNames, setSelectedAddOnNames] = useState([]);
    const [selectedBeauticianId, setSelectedBeauticianId] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [useBeautician, setUseBeautician] = useState(false);

    // State for data from Firestore
    const [services, setServices] = useState([]);
    const [beauticians, setBeauticians] = useState([]);
    const [unavailableBeauticianIds, setUnavailableBeauticianIds] = useState(new Set());
    const defaultWeeklySchedule = {
        0: { isOpen: false },
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        3: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        4: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        6: { isOpen: false }
    };

    const [bookingSettings, setBookingSettings] = useState({
        timeQueues: [],
        weeklySchedule: defaultWeeklySchedule,
        holidayDates: [],
        totalBeauticians: 1,
        useBeautician: true
    });
    const [slotCounts, setSlotCounts] = useState({});

    // State for UI
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState(null);
    const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
    const [timeQueueFull, setTimeQueueFull] = useState(false);
    const [isDayBusy, setIsDayBusy] = useState(false);
    const [busyDays, setBusyDays] = useState({});
    const [activeMonth, setActiveMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });

    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            input[type="date"]::-webkit-calendar-picker-indicator {
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [settingsDoc, bookingSettingsDoc] = await Promise.all([
                    getDoc(doc(db, 'settings', 'general')),
                    getDoc(doc(db, 'settings', 'booking'))
                ]);

                if (bookingSettingsDoc.exists()) {
                    const settings = bookingSettingsDoc.data();
                    setBookingSettings(prev => {
                        const weeklySchedule = settings.weeklySchedule || defaultWeeklySchedule;
                        return {
                            ...prev,
                            timeQueues: Array.isArray(settings.timeQueues) ? settings.timeQueues : [],
                            totalBeauticians: Number(settings.totalBeauticians) || 1,
                            useBeautician: !!settings.useBeautician,
                            holidayDates: Array.isArray(settings.holidayDates) ? settings.holidayDates : [],
                            weeklySchedule: weeklySchedule
                        };
                    });
                }

                setLoading(false);
            } catch (error) {
                console.error("Error fetching data:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
                setLoading(false);
            }
        };
        fetchData();

        const servicesQuery = query(
            collection(db, 'services'),
            orderBy('serviceName')
        );
        const unsubscribeServices = onSnapshot(
            servicesQuery, 
            (snapshot) => {
                const allServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const sortedServices = allServices.sort((a, b) => {
                    if (a.isFavorite && !b.isFavorite) return -1;
                    if (!a.isFavorite && b.isFavorite) return 1;
                    return (a.serviceName || '').localeCompare(b.serviceName || '', 'th');
                });
                setServices(sortedServices);
            },
            (error) => {
                console.error('Services onSnapshot error:', error);
                getDocs(servicesQuery).then(snapshot => {
                    const allServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const sortedServices = allServices.sort((a, b) => {
                        if (a.isFavorite && !b.isFavorite) return -1;
                        if (!a.isFavorite && b.isFavorite) return 1;
                        return (a.serviceName || '').localeCompare(b.serviceName || '', 'th');
                    });
                    setServices(sortedServices);
                }).catch(err => console.error('Services fallback error:', err));
            }
        );

        const beauticiansQuery = query(
            collection(db, 'beauticians'),
            where('status', '==', 'available'),
            orderBy('firstName')
        );
        const unsubscribeBeauticians = onSnapshot(
            beauticiansQuery,
            (snapshot) => {
                setBeauticians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            },
            (error) => {
                console.error('Beauticians onSnapshot error:', error);
                getDocs(beauticiansQuery).then(snapshot => {
                    setBeauticians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }).catch(err => console.error('Beauticians fallback error:', err));
            }
        );

        return () => {
            unsubscribeServices();
            unsubscribeBeauticians();
        };
    }, []);

    useEffect(() => {
        if (!appointmentDate) return;

        const dateStr = format(new Date(appointmentDate), 'yyyy-MM-dd');
        const q = query(
            collection(db, 'appointments'),
            where('date', '==', dateStr),
            where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const appointmentsForDay = querySnapshot.docs.map(doc => doc.data());
            const counts = {};
            appointmentsForDay.forEach(appt => {
                if (appt.time) {
                    counts[appt.time] = (counts[appt.time] || 0) + 1;
                }
            });
            setSlotCounts(counts);

            if (appointmentTime) {
                const unavailableIds = new Set(
                    appointmentsForDay
                        .filter(appt => appt.time === appointmentTime && appt.beauticianId)
                        .map(appt => appt.beauticianId)
                );
                setUnavailableBeauticianIds(unavailableIds);

                if (selectedBeauticianId && unavailableIds.has(selectedBeauticianId)) {
                    setSelectedBeauticianId('');
                    showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning', 'โปรดเลือกช่างใหม่');
                }
            } else {
                setUnavailableBeauticianIds(new Set());
            }
        });

        setIsDayBusy(busyDays[dateStr] ?? false);
        return () => unsubscribe();
    }, [appointmentDate, appointmentTime, selectedBeauticianId, showToast, busyDays]);

    useEffect(() => {
        const fetchMonthBusyDays = async () => {
            const year = activeMonth.getFullYear();
            const month = activeMonth.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const busyMap = {};
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day, 7, 0, 0);
                const dateStr = format(date, 'yyyy-MM-dd');
                try {
                    const docRef = doc(db, 'dayBookingStatus', dateStr);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        busyMap[dateStr] = docSnap.data().isBusy ?? false;
                    } else {
                        busyMap[dateStr] = false;
                    }
                } catch {
                    busyMap[dateStr] = false;
                }
            }
            setBusyDays(busyMap);
        };
        fetchMonthBusyDays();
    }, [activeMonth]);

    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const selectedAddOns = useMemo(() => (selectedService?.addOnServices || []).filter(a => selectedAddOnNames.includes(a.name)), [selectedService, selectedAddOnNames]);

    const { basePrice, addOnsTotal, totalPrice, totalDuration } = useMemo(() => {
        if (!selectedService) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, totalDuration: 0 };
        const base = Number(selectedService.price || selectedService.basePrice || 0);
        const addOnsPrice = selectedAddOns.reduce((sum, a) => sum + Number(a.price || 0), 0);
        const duration = Number(selectedService.duration || 0) + selectedAddOns.reduce((sum, a) => sum + Number(a.duration || 0), 0);
        return { 
            basePrice: base, 
            addOnsTotal: addOnsPrice, 
            totalPrice: base + addOnsPrice, 
            totalDuration: duration 
        };
    }, [selectedService, selectedAddOns]);

    const checkExistingCustomer = async (phone, lineUserId) => {
        if (!phone && !lineUserId) {
            setExistingCustomer(null);
            return;
        }

        setIsCheckingCustomer(true);
        try {
            if (lineUserId) {
                const customerDoc = await getDoc(doc(db, 'customers', lineUserId));
                if (customerDoc.exists()) {
                    const customer = { id: customerDoc.id, ...customerDoc.data() };
                    setExistingCustomer(customer);
                    if (customer.address && !customerInfo.address) {
                        setCustomerInfo(prev => ({ ...prev, address: customer.address }));
                    }
                    setIsCheckingCustomer(false);
                    return;
                }
            }

            if (phone) {
                const q = query(collection(db, 'customers'), where('phone', '==', phone));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const customerData = snapshot.docs[0];
                    const customer = { id: customerData.id, ...customerData.data() };
                    setExistingCustomer(customer);
                    if (customer.address && !customerInfo.address) {
                        setCustomerInfo(prev => ({ ...prev, address: customer.address }));
                    }
                } else {
                    setExistingCustomer(null);
                }
            }
        } catch (error) {
            console.error('Error checking customer:', error);
            setExistingCustomer(null);
        } finally {
            setIsCheckingCustomer(false);
        }
    };

    useEffect(() => {
        const shouldCheck = (customerInfo.phone && customerInfo.phone.length >= 9) || (customerInfo.lineUserId && customerInfo.lineUserId.length > 0);
        if (!shouldCheck) {
            setExistingCustomer(null);
            return;
        }
        const timeoutId = setTimeout(() => {
            checkExistingCustomer(customerInfo.phone, customerInfo.lineUserId);
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [customerInfo.phone, customerInfo.lineUserId]);

    useEffect(() => {
        setAppointmentTime('');
        setSelectedBeauticianId('');
    }, [appointmentDate]);
    
    // [!code focus start]
    // แก้ไข: ห่อหุ้มฟังก์ชัน Helper ด้วย useCallback เพื่อให้ฟังก์ชันมีความเสถียร
    const getThaiDateString = useCallback((date) => {
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0);
        return format(localDate, 'yyyy-MM-dd');
    }, []);

    const checkHolidayDate = useCallback((date) => {
        const dateString = getThaiDateString(date);
        const specialHoliday = bookingSettings.holidayDates?.find(h => h.date === dateString);
        const dayOfWeek = date.getDay();
        const isWeekendHoliday = !bookingSettings.weeklySchedule?.[dayOfWeek]?.isOpen;
        return {
            isHoliday: !!specialHoliday || isWeekendHoliday,
            holidayInfo: specialHoliday || (isWeekendHoliday ? { reason: 'วันหยุดประจำสัปดาห์' } : null)
        };
    }, [getThaiDateString, bookingSettings.holidayDates, bookingSettings.weeklySchedule]);
    
    const isDateOpen = useCallback((date) => {
        const dayOfWeek = date.getDay();
        const daySchedule = bookingSettings.weeklySchedule[dayOfWeek];
        if (!daySchedule || !daySchedule.isOpen) {
            return false;
        }
        const dateStr = getThaiDateString(date);
        const isHoliday = bookingSettings.holidayDates.some(holiday => holiday.date === dateStr);
        return !isHoliday;
    }, [bookingSettings.weeklySchedule, bookingSettings.holidayDates, getThaiDateString]);

    const isDateDisabled = useCallback((date) => {
        return !isDateOpen(date);
    }, [isDateOpen]);
    // [!code focus end]

    const availableTimeSlots = useMemo(() => {
        if (!appointmentDate || !bookingSettings?.timeQueues) {
            return [];
        }
        const selectedDate = new Date(appointmentDate);
        const dayOfWeek = selectedDate.getDay();
        const daySchedule = bookingSettings.weeklySchedule?.[dayOfWeek];
        const holiday = checkHolidayDate(selectedDate);
        if (holiday.isHoliday || !daySchedule?.isOpen) {
            return [];
        }
        const openTime = daySchedule?.openTime?.replace(':', '') || '0900';
        const closeTime = daySchedule?.closeTime?.replace(':', '') || '1700';
        const slots = bookingSettings.timeQueues
            .filter(q => {
                if (!q?.time) return false;
                const slotTime = q.time.replace(':', '');
                return slotTime >= openTime && slotTime <= closeTime;
            })
            .map(queue => queue.time)
            .sort();
        setTimeQueueFull(slots.length === 0);
        return slots;
    }, [appointmentDate, bookingSettings, checkHolidayDate]);

    const handleServiceChange = (e) => {
        setSelectedServiceId(e.target.value);
        setSelectedAddOnNames([]);
    };

    const handleAddOnToggle = (addOnName) => {
        setSelectedAddOnNames(prev =>
            prev.includes(addOnName)
                ? prev.filter(name => name !== addOnName)
                : [...prev, addOnName]
        );
    };

    const handleCustomerInfoChange = (e) => {
        const { name, value } = e.target;
        setCustomerInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedServiceId || (useBeautician && !selectedBeauticianId) || !appointmentDate || !appointmentTime || !customerInfo.fullName || !customerInfo.phone || !customerInfo.address) {
            showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึงที่อยู่)', 'error');
            return;
        }
        const now = new Date();
        const bookingDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
        if (bookingDateTime - now < 60 * 60 * 1000) {
            showToast('ต้องจองล่วงหน้าอย่างน้อย 1 ชั่วโมง', 'error');
            return;
        }
        
        const reCheckSlots = slotCounts[appointmentTime] || 0;
        let maxSlots = 50; 
        
        if (bookingSettings.timeQueues && bookingSettings.timeQueues.length > 0) {
            const specificQueue = bookingSettings.timeQueues.find(q => q.time === appointmentTime);
            if (specificQueue && typeof specificQueue.count === 'number') {
                maxSlots = specificQueue.count;
            } else if (bookingSettings.totalBeauticians) {
                maxSlots = Number(bookingSettings.totalBeauticians);
            }
        } else if (bookingSettings.totalBeauticians) {
            maxSlots = Number(bookingSettings.totalBeauticians);
        }
        
        if (reCheckSlots >= maxSlots) {
            showToast('ช่วงเวลาที่เลือกเต็มแล้ว กรุณาเลือกเวลาใหม่', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const customerResult = await findOrCreateCustomer({
                fullName: customerInfo.fullName,
                phone: customerInfo.phone,
                address: customerInfo.address,
                note: customerInfo.note
            }, customerInfo.lineUserId || null);

            if (!customerResult.success) {
                throw new Error(customerResult.error || 'ไม่สามารถสร้างข้อมูลลูกค้าได้');
            }

            if (customerResult.mergedPoints > 0) {
                showToast(`พบการรวมแต้ม: ${customerResult.mergedPoints} แต้ม`, 'info');
            }

            let beautician = null;
            if (useBeautician && selectedBeauticianId) {
                beautician = beauticians.find(b => b.id === selectedBeauticianId);
            }

            const appointmentData = {
                userId: customerResult.customerId,
                userInfo: { displayName: customerInfo.fullName },
                status: 'awaiting_confirmation',
                customerInfo: {
                    fullName: customerInfo.fullName || '',
                    phone: customerInfo.phone || '',
                    address: customerInfo.address || '',
                    note: customerInfo.note || '',
                    customerId: customerResult.customerId || '',
                    lineUserId: customerInfo.lineUserId || ''
                },
                serviceInfo: selectedService ? {
                    id: selectedService.id || '',
                    name: selectedService.serviceName || '',
                    imageUrl: selectedService.imageUrl || '',
                    duration: Number(selectedService.duration ?? 0),
                    addOns: selectedAddOns || []
                } : {
                    id: '',
                    name: '',
                    imageUrl: '',
                    duration: 0,
                    addOns: []
                },
                appointmentInfo: {
                    date: appointmentDate || '',
                    time: appointmentTime || '',
                    dateTime: new Date(`${appointmentDate}T${appointmentTime}`),
                    beauticianId: useBeautician ? (beautician?.id || '') : '',
                    employeeId: use
