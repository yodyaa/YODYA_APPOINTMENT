"use client";
import { useState, useEffect } from "react";
// ...existing code...
import { updateWorkorderStatusByAdmin } from "@/app/actions/workorderActions";
import { notifyStatusChange, notifyPaymentStatusChange } from "@/app/actions/notificationActions";
import { sendServiceCompletedFlexMessage } from "@/app/actions/lineFlexActions";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";

export default function WorkorderAdminPage() {
  const router = useRouter();
  // State สำหรับ settings แจ้งเตือนลูกค้า (move inside component)
  const [customerNotifySettings, setCustomerNotifySettings] = useState({ notifyProcessing: true, notifyCompleted: true });
  // State สำหรับ settings แจ้งเตือนแอดมินเมื่อเปลี่ยนสถานะเก็บเงิน
  const [adminNotifySettings, setAdminNotifySettings] = useState({ collectionStatusChanged: true });

  // โหลด settings แจ้งเตือนลูกค้า จาก Firestore
  useEffect(() => {
    const fetchNotifySettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'notifications'));
        if (snap.exists()) {
          const data = snap.data();
          setCustomerNotifySettings({
            notifyProcessing: data?.customerNotifications?.notifyProcessing !== false,
            notifyCompleted: data?.customerNotifications?.notifyCompleted !== false
          });
          setAdminNotifySettings({
            collectionStatusChanged: data?.adminNotifications?.collectionStatusChanged !== false
          });
        }
      } catch (e) {
        // fallback: เปิดไว้เสมอ
        setCustomerNotifySettings({ notifyProcessing: true, notifyCompleted: true });
        setAdminNotifySettings({ collectionStatusChanged: true });
      }
    };
    fetchNotifySettings();
  }, []);
  // หน้าแผนงานรายวัน
  const [workorders, setWorkorders] = useState([]);
  const [editingCell, setEditingCell] = useState({}); // { [workorderId]: { field: value } }
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [staffCount, setStaffCount] = useState(3); // จำนวนช่างเริ่มต้น
  const [dailyStaffSettings, setDailyStaffSettings] = useState({});
  const [productivityThreshold, setProductivityThreshold] = useState(1000); // Productivity ต่อช่างที่แอดมินกำหนด
  const [dailyProductivitySettings, setDailyProductivitySettings] = useState({}); // จำ productivity แต่ละวัน

  // Sync selectedDate with ?date=... query string
  const searchParams = useSearchParams();
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      // Only update if different (avoid infinite loop)
      const paramDate = new Date(dateParam);
      if (!isNaN(paramDate) && selectedDate.toISOString().split('T')[0] !== dateParam) {
        setSelectedDate(paramDate);
      }
    }
  }, [searchParams, selectedDate]);
  
  // วันที่ที่เลือกในรูปแบบ string
  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  
  // กรองงานตามวันที่เลือก - รองรับทั้ง workorder และ appointment
  const selectedDayWorkorders = workorders.filter(w => w.date === selectedDateStr);
  const selectedDayAppointments = appointments.filter(a => a.date === selectedDateStr);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // ดึงข้อมูลงาน
        const workordersSnapshot = await getDocs(collection(db, "workorders"));
        const workordersData = workordersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setWorkorders(workordersData);

        // ดึงข้อมูลบริการ
        const servicesSnapshot = await getDocs(collection(db, "services"));
        const servicesData = servicesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setServices(servicesData);

        // ดึงข้อมูลการนัดหมาย - ใช้โครงสร้างมาตรฐาน
        const appointmentsSnapshot = await getDocs(collection(db, "appointments"));
        const appointmentsData = appointmentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          // ใช้โครงสร้างมาตรฐาน customerInfo, serviceInfo, appointmentInfo, paymentInfo
          type: 'appointment', // เพิ่ม type เพื่อแยกประเภท
          caseNumber: doc.data().caseNumber || doc.data().id?.substring(0,3),
        }));
        setAppointments(appointmentsData);
        // ดึงการตั้งค่าจำนวนช่างรายวัน
        const dailySettingsSnapshot = await getDocs(collection(db, "dailyStaffSettings"));
        const dailySettingsData = {};
        dailySettingsSnapshot.docs.forEach(doc => {
          dailySettingsData[doc.id] = doc.data().staffCount || 3;
        });
        setDailyStaffSettings(dailySettingsData);

        // ดึงการตั้งค่า productivity รายวัน
        const dailyProductivitySnapshot = await getDocs(collection(db, "dailyProductivitySettings"));
        const dailyProductivityData = {};
        dailyProductivitySnapshot.docs.forEach(doc => {
          dailyProductivityData[doc.id] = doc.data().productivityThreshold || 1000;
        });
        setDailyProductivitySettings(dailyProductivityData);

      } catch (err) {
        console.error("Error fetching data:", err);
        setWorkorders([]);
        setServices([]);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // ฟังก์ชันช่วยจัดการข้อมูลที่อาจไม่มี
  const safe = (val, fallback = "-") => (val !== undefined && val !== null && val !== "" ? val : fallback);

  // ตัวเลือกสถานะงานใหม่
  const processStatusOptions = ["อยู่ในแผนงาน", "ช่างกำลังดำเนินการ", "เสร็จสิ้น"];

  // ตัวเลือกช่าง: ดึงจาก gardeners collection เท่านั้น
  const [gardeners, setGardeners] = useState([]);
  useEffect(() => {
    const fetchGardeners = async () => {
      try {
        const snapshot = await getDocs(collection(db, "gardeners"));
        setGardeners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setGardeners([]);
      }
    };
    fetchGardeners();
  }, []);

  // ฟังก์ชันบันทึกการแก้ไข
  const handleInlineEdit = async (workorderId, field, value) => {
    // ตรวจสอบว่าเป็น appointment หรือ workorder
    const isAppointment = appointments.some(a => a.id === workorderId);
    const isWorkorder = workorders.some(w => w.id === workorderId);
    let updatedObj = null;
    let prevStatus = null;
    let newStatus = null;
    let customerLineId = null;
    let appointmentData = null;

    if (isAppointment) {
      setAppointments(prev => prev.map(a => {
        if (a.id === workorderId) {
          if (field === 'appointmentInfo' && value.beauticianName !== undefined) {
            return { ...a, appointmentInfo: { ...a.appointmentInfo, ...value } };
          }
          return { ...a, [field]: value };
        }
        return a;
      }));
      try {
        const updateData = typeof value === 'object' ? { [field]: value } : { [field]: value };
        
        // ถ้าเปลี่ยน processStatus ให้อัปเดต status ตามเงื่อนไข
        if (field === 'processStatus') {
          if (value === 'เสร็จสิ้น') {
            updateData.status = 'completed';
          } else if (value === 'ช่างกำลังดำเนินการ') {
            updateData.status = 'in_progress';
          } else if (value === 'อยู่ในแผนงาน') {
            updateData.status = 'confirmed';
          }
        }
        
        // ดึงข้อมูล appointment เดิม
        const docSnap = await getDoc(doc(db, "appointments", workorderId));
        const oldData = docSnap.exists() ? docSnap.data() : {};
        prevStatus = oldData.processStatus || oldData.status;
        newStatus = (field === 'processStatus') ? value : oldData.processStatus || oldData.status;
        appointmentData = { id: workorderId, ...oldData, ...updateData };
        customerLineId = oldData.customerInfo?.lineUserId;
        await updateDoc(doc(db, "appointments", workorderId), updateData);
        // แจ้งเตือน LINE เฉพาะเมื่อเปลี่ยนสถานะและเปิด toggle จาก settings
        if (field === 'processStatus' && customerLineId) {
          console.log('[DEBUG] ตรวจสอบก่อนส่ง Flex', {
            field,
            value,
            customerLineId,
            appointmentData,
            notifyProcessing: customerNotifySettings.notifyProcessing,
            notifyCompleted: customerNotifySettings.notifyCompleted
          });
          // ส่ง Flex Message เฉพาะเมื่อเสร็จสิ้น เท่านั้น
          if (value === 'เสร็จสิ้น' && customerNotifySettings.notifyCompleted) {
            console.log('[LINE FLEX] เรียก sendServiceCompletedFlexMessage', { customerLineId, appointmentData });
            const result = await sendServiceCompletedFlexMessage(customerLineId, appointmentData);
            console.log('[LINE FLEX] ผลลัพธ์ sendServiceCompletedFlexMessage', result);
          } else {
            console.log('[LINE FLEX] ไม่เข้าเงื่อนไขส่ง Flex', {
              field,
              value,
              customerLineId,
              notifyProcessing: customerNotifySettings.notifyProcessing,
              notifyCompleted: customerNotifySettings.notifyCompleted,
              reason: value === 'ช่างกำลังดำเนินการ' ? 'ไม่ส่ง Flex สำหรับสถานะกำลังดำเนินการ' : 'สถานะไม่ตรงเงื่อนไข'
            });
          }
        } else if (field === 'processStatus') {
          console.log('[LINE FLEX] ไม่พบ customerLineId หรือ field ไม่ถูกต้อง', { field, value, customerLineId });
        }
        // คำนวณและอัปเดตสถิติทันทีหลังบันทึกข้อมูล
        const stats = await calculateDayStats();
        setDayStats(stats);
      } catch (err) {
        console.error("Error updating appointment:", err);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลการนัดหมาย");
      }
    } else if (isWorkorder) {
      setWorkorders(prev => prev.map(w => w.id === workorderId ? { ...w, [field]: value } : w));
      try {
        // เรียก server action เพื่อ update และส่ง Flex Message
        const result = await updateWorkorderStatusByAdmin({ 
          workorderId, 
          field, 
          value, 
          adminName: 'Admin' 
        });
        if (!result.success) {
          throw new Error(result.error || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
        }

        // อัพเดท appointment ที่เกี่ยวข้องกับ workorder นี้ (ถ้ามี)
        if (field === 'processStatus') {
          const workorder = workorders.find(w => w.id === workorderId);
          const relatedAppointmentId = workorder?.bookingId;
          
          if (relatedAppointmentId) {
            try {
              let appointmentStatus = 'confirmed'; // default
              if (value === 'เสร็จสิ้น') {
                appointmentStatus = 'completed';
              } else if (value === 'ช่างกำลังดำเนินการ') {
                appointmentStatus = 'in_progress';
              } else if (value === 'อยู่ในแผนงาน') {
                appointmentStatus = 'confirmed';
              }

              // อัพเดท appointment status และ processStatus
              await updateDoc(doc(db, "appointments", relatedAppointmentId), {
                status: appointmentStatus,
                processStatus: value,
                updatedAt: new Date()
              });

              // อัพเดท state ของ appointments ด้วย
              setAppointments(prev => prev.map(a => 
                a.id === relatedAppointmentId 
                  ? { ...a, status: appointmentStatus, processStatus: value }
                  : a
              ));

              console.log('[WORKORDER] อัพเดท appointment สำเร็จ:', {
                appointmentId: relatedAppointmentId,
                newStatus: appointmentStatus,
                processStatus: value
              });
            } catch (appointmentUpdateErr) {
              console.error('[WORKORDER] ERROR อัพเดท appointment:', appointmentUpdateErr);
              // ไม่หยุดการทำงาน แค่ log error
            }
          }
        }

        // คำนวณและอัปเดตสถิติทันทีหลังบันทึกข้อมูล workorder
        const stats = await calculateDayStats();
        setDayStats(stats);
      } catch (err) {
        console.error("Error updating workorder:", err);
        // ถ้า error ให้ revert กลับ
        setWorkorders(prev => prev.map(w => w.id === workorderId ? { ...w, [field]: w[field] } : w));
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล workorder");
      }
    }
  };

  // คำนวณข้อมูลสำหรับวันที่เลือก และบันทึกสถานะ busy ลง Firestore
  const calculateDayStats = async () => {
    const dayAppointments = appointments.filter(apt => apt.date === selectedDateStr);
    const currentStaffCount = dailyStaffSettings[selectedDateStr] || staffCount;
    const currentProductivity = dailyProductivitySettings[selectedDateStr] || productivityThreshold;
    let totalRevenue = 0;
    let totalDuration = 0;
    
    // คำนวณรายได้จาก workorders
    selectedDayWorkorders.forEach(wo => {
      const service = services.find(s => s.serviceName === wo.workorder || s.name === wo.workorder);
      const price = wo.price !== undefined && wo.price !== null && wo.price !== '' ? Number(wo.price) : (service?.price || 0);
      totalRevenue += price;
      totalDuration += service?.duration || 0;
    });
    
    // คำนวณรายได้จาก appointments
    dayAppointments.forEach(apt => {
      const price = apt.paymentInfo?.totalPrice || apt.serviceInfo?.price || 0;
      totalRevenue += Number(price);
      const duration = apt.appointmentInfo?.duration || apt.serviceInfo?.duration || 0;
      totalDuration += Number(duration);
    });
    
    const avgProductivity = currentStaffCount > 0 ? totalRevenue / currentStaffCount : 0;
    // ถ้า totalRevenue > currentProductivity * currentStaffCount ให้ถือว่าไม่ว่าง
    const isBusy = totalRevenue > (currentProductivity * currentStaffCount);

    // บันทึกสถานะ busy ลง Firestore
    try {
      await setDoc(doc(db, "dayBookingStatus", selectedDateStr), {
        isBusy,
        date: selectedDateStr,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error saving dayBookingStatus:", error);
    }

    return {
      totalCustomers: selectedDayWorkorders.length,
      totalAppointments: dayAppointments.length,
      totalRevenue,
      totalDuration,
      avgProductivity,
      currentStaffCount,
      isBusy
    };
  };

  const [dayStats, setDayStats] = useState({
    totalCustomers: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    totalDuration: 0,
    avgProductivity: 0,
    currentStaffCount: staffCount,
    isBusy: false
  });

  useEffect(() => {
    // คำนวณและบันทึกสถานะ busy เฉพาะเมื่อ selectedDate เปลี่ยน หรือกดรีเฟรช
    const updateStats = async () => {
      const stats = await calculateDayStats();
      setDayStats(stats);
    };
    updateStats();
    // eslint-disable-next-line
  }, [selectedDateStr, staffCount, dailyStaffSettings, productivityThreshold, dailyProductivitySettings]);

  // บันทึกการตั้งค่าจำนวนช่าง
  const handleStaffCountChange = async (newCount) => {
    setStaffCount(newCount);
    try {
      await setDoc(doc(db, "dailyStaffSettings", selectedDateStr), {
        staffCount: newCount,
        date: selectedDateStr,
        updatedAt: new Date()
      });
      setDailyStaffSettings(prev => ({
        ...prev,
        [selectedDateStr]: newCount
      }));
    } catch (error) {
      console.error("Error saving staff count:", error);
    }
  };

  // บันทึกการตั้งค่า productivity ต่อช่าง
  const handleProductivityChange = async (newProductivity) => {
    setProductivityThreshold(newProductivity);
    try {
      await setDoc(doc(db, "dailyProductivitySettings", selectedDateStr), {
        productivityThreshold: newProductivity,
        date: selectedDateStr,
        updatedAt: new Date()
      });
      setDailyProductivitySettings(prev => ({
        ...prev,
        [selectedDateStr]: newProductivity
      }));
    } catch (error) {
      console.error("Error saving productivity threshold:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 md:px-8  py-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">แผนงานรายวัน</h1>
      {/* Navigation Bar */}
      <div className="flex gap-4 mb-6">
        <Link href="/workorder" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-indigo-700">
          งานทั้งหมด
        </Link>
        <Link href="/workorder/create" className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700">
          สร้างงาน
        </Link>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-gray-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-gray-700"
        >
          รีเฟรช
        </button>
      </div>

      {/* Date Picker และการตั้งค่า */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">เลือกวันที่</label>
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => {
                // Update both state and URL query string
                const newDate = e.target.value;
                setSelectedDate(new Date(newDate));
                // Update URL query string
                router.push(`/workorder?date=${newDate}`);
              }}
              className="border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div className="flex flex-row gap-4 items-center ml-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนช่าง</label>
              <select
                value={dailyStaffSettings[selectedDateStr] || staffCount}
                onChange={(e) => handleStaffCountChange(parseInt(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                {[1,2,3,4,5,6,7,8,9,10].map(num => (
                  <option key={num} value={num}>{num} คน</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Productivity/ช่าง</label>
              <input
                type="number"
                value={dailyProductivitySettings[selectedDateStr] || productivityThreshold}
                onChange={e => handleProductivityChange(Number(e.target.value))}
                className="border rounded px-2 py-2 w-24 text-center"
                min={0}
              />
            </div>
          </div>
          {dayStats.isFullyBooked && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
              🔴 คิวเต็ม - ไม่รับจองเพิ่ม
            </div>
          )}
        </div>
      </div>

      {/* สถิติสรุปสำหรับวันที่เลือก */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">สรุปข้อมูลวันที่ {selectedDate.toLocaleDateString('th-TH')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="bg-blue-50 p-3 rounded col-span-1 text-left">
            <div className="text-2xl font-bold text-blue-600">{dayStats.totalCustomers}</div>
            <div className="text-sm text-blue-600">จำนวนลูกค้า</div>
          </div>
          <div className="bg-green-50 p-3 rounded col-span-1 text-left">
            <div className="text-2xl font-bold text-green-600">{dayStats.totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-green-600">รายได้ (บาท)</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded col-span-1 text-right">
            <div className="text-2xl font-bold text-yellow-600">{dayStats.currentStaffCount}</div>
            <div className="text-sm text-yellow-600">จำนวนช่าง</div>
          </div>
          <div className="bg-purple-50 p-3 rounded col-span-1 text-right">
            <div className="text-2xl font-bold text-purple-600">{Math.round(dayStats.avgProductivity).toLocaleString()}</div>
            <div className="text-sm text-purple-600">Productivity/ช่างจริง</div>
          </div>
          <div className="bg-pink-50 p-3 rounded col-span-1 text-right">
            <div className={`text-2xl font-bold ${dayStats.isBusy ? 'text-red-600' : 'text-green-600'}`}>{dayStats.isBusy ? 'ไม่ว่าง' : 'ว่าง'}</div>
            <div className="text-sm text-pink-600">สถานะ</div>
          </div>
        </div>
      </div>
      {/* ตารางแผนงานรายวัน */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        {loading ? (
          <div className="text-center py-8 text-gray-500">กำลังโหลดข้อมูลงาน...</div>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-4">แผนงานรายวัน - {selectedDate.toLocaleDateString('th-TH')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-gray-100 text-sm">
                    <th className="p-2 border font-normal">สถานะ</th>
                    <th className="p-2 border font-normal">เคสที่</th>
                    <th className="p-2 border font-normal">เวลา</th>
                    <th className="p-2 border font-normal">ลูกค้า</th>
                    <th className="p-2 border font-normal">บริการ</th>
                    <th className="p-2 border font-normal">ราคา (บาท)</th>
                    <th className="p-2 border font-normal">สถานะเก็บเงิน</th>
                    <th className="p-2 border font-normal">ช่าง</th>
                    <th className="p-2 border font-normal">รายละเอียดงาน</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayWorkorders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-4 text-gray-400 text-sm">
                        ไม่มีงานในวันที่เลือก
                      </td>
                    </tr>
                  ) : (
                    selectedDayWorkorders.map((w) => {
                      const service = services.find(s => s.serviceName === w.workorder || s.name === w.workorder);
                      const serviceDuration = service?.duration || 0;
                      const price = w.price !== undefined && w.price !== null && w.price !== '' ? w.price : (service?.price || 0);
                      return (
                        <tr key={w.idKey || w.id} className="border-b hover:bg-gray-50 text-sm">
                          {/* สถานะ */}
                          <td className="p-2 border">
                            <select
                              value={w.processStatus || ''}
                              onChange={async e => {
                                const newStatus = e.target.value;
                                const oldStatus = w.processStatus || '';
                                console.log('[DROPDOWN] เปลี่ยนสถานะ', { id: w.id, old: oldStatus, new: newStatus });
                                
                                // อัพเดทสถานะ
                                handleInlineEdit(w.id, 'processStatus', newStatus);

                                // แจ้งเตือนแอดมินและลูกค้าเมื่อเปลี่ยนสถานะ
                                if (newStatus && newStatus !== oldStatus) {
                                  try {
                                    await notifyStatusChange(
                                      { ...w, date: w.date || selectedDateStr },
                                      newStatus,
                                      oldStatus,
                                      customerNotifySettings
                                    );
                                  } catch (notifyErr) {
                                    console.error('[WORK STATUS] แจ้งเตือน ERROR:', notifyErr);
                                  }
                                }
                              }}
                              className={`px-2 py-1 rounded text-sm font-medium w-full ${
                                w.processStatus === 'อยู่ในแผนงาน' ? 'bg-blue-100 text-blue-800' :
                                w.processStatus === 'ช่างกำลังดำเนินการ' ? 'bg-yellow-100 text-yellow-800' :
                                w.processStatus === 'เสร็จสิ้น' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {processStatusOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          {/* เคสที่ */}
                          <td className="p-2 border text-center">
                            <input
                              type="text"
                              value={w.caseNumber || ''}
                              onChange={e => handleInlineEdit(w.id, 'caseNumber', e.target.value)}
                              className="border rounded px-2 py-1 w-12 text-center font-bold bg-indigo-50 text-indigo-800"
                              placeholder="?"
                            />
                          </td>
                          {/* เวลา */}
                          <td className="p-2 border text-center">
                            <input
                              type="text"
                              value={w.time || ''}
                              onChange={e => handleInlineEdit(w.id, 'time', e.target.value)}
                              className="border rounded px-2 py-1 w-20 text-center"
                              placeholder="เวลา"
                            />
                          </td>
                          {/* ลูกค้า */}
                          <td className="p-2 border">
                            {w.type === 'appointment' 
                              ? safe(w.customerInfo?.fullName) 
                              : safe(w.name)
                            }
                          </td>
                          {/* บริการ */}
                          <td className="p-2 border">
                            {(() => {
                              if (w.type === 'appointment') {
                                return safe(w.serviceInfo?.name)
                                  || safe(w.workorder)
                                  || safe(w.serviceName)
                                  || '-';
                              } else {
                                return safe(w.workorder)
                                  || safe(w.serviceName)
                                  || '-';
                              }
                            })()}
                          </td>
                          {/* ราคา */}
                          <td className="p-2 border text-right font-semibold text-green-600">
                            <input
                              type="number"
                              value={
                                w.type === 'appointment' 
                                  ? (w.paymentInfo?.totalPrice !== undefined && w.paymentInfo?.totalPrice !== null && w.paymentInfo?.totalPrice !== '' ? w.paymentInfo.totalPrice : '')
                                  : (w.price !== undefined && w.price !== null && w.price !== '' ? w.price : '')
                              }
                              onChange={e => {
                                const field = w.type === 'appointment' ? 'paymentInfo.totalPrice' : 'price';
                                if (w.type === 'appointment') {
                                  handleInlineEdit(w.id, 'paymentInfo', {...(w.paymentInfo || {}), totalPrice: e.target.value});
                                } else {
                                  handleInlineEdit(w.id, 'price', e.target.value);
                                }
                              }}
                              className="border rounded px-2 py-1 w-20 text-right text-green-700"
                              min={0}
                              placeholder="-"
                            />
                          </td>
                          {/* สถานะเก็บเงิน */}
                          <td className="p-2 border text-center">
                            <select
                              value={
                                w.type === 'appointment' 
                                  ? (w.paymentInfo?.paymentStatus || '') 
                                  : (w.paymentStatus || '')
                              }
                              onChange={async e => {
                                const newPaymentStatus = e.target.value;
                                const oldPaymentStatus = w.type === 'appointment' 
                                  ? (w.paymentInfo?.paymentStatus || '') 
                                  : (w.paymentStatus || '');
                                
                                if (w.type === 'appointment') {
                                  handleInlineEdit(w.id, 'paymentInfo', {...(w.paymentInfo || {}), paymentStatus: newPaymentStatus});
                                } else {
                                  handleInlineEdit(w.id, 'paymentStatus', newPaymentStatus);
                                }

                                // แจ้งเตือนแอดมินเมื่อเปลี่ยนสถานะเก็บเงิน
                                if (newPaymentStatus && newPaymentStatus !== oldPaymentStatus) {
                                  try {
                                    // ตรวจสอบว่าเปิดการแจ้งเตือนหรือไม่
                                    if (adminNotifySettings.collectionStatusChanged) {
                                      await notifyPaymentStatusChange(
                                        { ...w, date: w.date || selectedDateStr },
                                        newPaymentStatus,
                                        oldPaymentStatus
                                      );
                                    }
                                  } catch (adminNotifyErr) {
                                    console.error('[PAYMENT STATUS] แจ้งเตือนแอดมิน ERROR:', adminNotifyErr);
                                  }
                                }
                              }}
                              className="border rounded px-2 py-1 w-full text-sm"
                            >
                              <option value="">เลือกสถานะ</option>
                              <option value="ส่งงานเรียบร้อยแล้ว">ส่งงานเรียบร้อยแล้ว</option>
                              <option value="เก็บเงินได้แล้ว">เก็บเงินได้แล้ว</option>
                              <option value="ติดตามทวงหนี้ ครั้งที่ 1">ติดตามทวงหนี้ ครั้งที่ 1</option>
                              <option value="ติดตามทวงหนี้ ครั้งที่ 2">ติดตามทวงหนี้ ครั้งที่ 2</option>
                              <option value="ติดตามทวงหนี้ ครั้งที่ 3">ติดตามทวงหนี้ ครั้งที่ 3</option>
                            </select>
                          </td>
                          {/* ช่างแก้ไข inline */}
                          <td className="p-2 border font-medium text-indigo-600">
                            <select
                              value={
                                w.type === 'appointment' 
                                  ? (w.appointmentInfo?.beauticianName || w.appointmentInfo?.beauticianInfo?.firstName || '') 
                                  : (w.beauticianName || w.responsible || '')
                              }
                              onChange={e => {
                                if (w.type === 'appointment') {
                                  handleInlineEdit(w.id, 'appointmentInfo', {...(w.appointmentInfo || {}), beauticianName: e.target.value});
                                } else {
                                  handleInlineEdit(w.id, 'beauticianName', e.target.value);
                                }
                              }}
                              className="border rounded px-2 py-1 w-full"
                            >
                              <option value="">เลือกช่าง</option>
                              {gardeners.map(g => (
                                <option key={g.id} value={g.fullName || g.name || (g.firstName + ' ' + (g.lastName || ''))}>
                                  {g.fullName || g.name || (g.firstName + ' ' + (g.lastName || ''))}
                                </option>
                              ))}
                            </select>
                          </td>
                          {/* รายละเอียด */}
                          <td className="p-2 border text-center">
                            <button
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                              onClick={() => {
                                window.open(`/workorder/detail/${w.id}`, '_blank');
                              }}
                            >
                              รายละเอียด
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-sm">
                    <td className="p-2 border text-center">-</td>
                    <td className="p-2 border text-center">-</td>
                    <td className="p-2 border text-center">-</td>
                    <td className="p-2 border text-center">{dayStats.totalCustomers} คน</td>
                    <td className="p-2 border text-center">-</td>
                    <td className="p-2 border text-right text-green-700">{dayStats.totalRevenue.toLocaleString()} บาท</td>
                    <td className="p-2 border text-center">-</td>
                    <td className="p-2 border text-center">{dayStats.currentStaffCount} คน</td>
                    <td className="p-2 border text-center">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}