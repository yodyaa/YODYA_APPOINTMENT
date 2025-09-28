"use client";
import { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";

// หน้าแผนงานรายวัน
export default function WorkorderAdminPage() {
  const [workorders, setWorkorders] = useState([]);
  const [editingCell, setEditingCell] = useState({}); // { [workorderId]: { field: value } }
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [staffCount, setStaffCount] = useState(3); // จำนวนช่างเริ่มต้น
  const [dailyStaffSettings, setDailyStaffSettings] = useState({});
  const [productivityThreshold, setProductivityThreshold] = useState(1000); // Productivity ต่อช่างที่แอดมินกำหนด
  
  // วันที่ที่เลือกในรูปแบบ string
  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  
  // กรองงานตามวันที่เลือก
  const selectedDayWorkorders = workorders.filter(w => w.date === selectedDateStr);

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

        // ดึงข้อมูลการนัดหมาย
        const appointmentsSnapshot = await getDocs(collection(db, "appointments"));
        const appointmentsData = appointmentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAppointments(appointmentsData);

        // ดึงการตั้งค่าจำนวนช่างรายวัน
        const dailySettingsSnapshot = await getDocs(collection(db, "dailyStaffSettings"));
        const dailySettingsData = {};
        dailySettingsSnapshot.docs.forEach(doc => {
          dailySettingsData[doc.id] = doc.data().staffCount || 3;
        });
        setDailyStaffSettings(dailySettingsData);

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

  // ตัวเลือกสถานะงาน
  const processStatusOptions = ["ใหม่", "กำลังดำเนินการ", "เสร็จสิ้น"];

  // ตัวเลือกช่าง (beauticianName หรือ responsible)
  const beauticianNames = Array.from(new Set(workorders.map(w => w.beauticianName || w.responsible).filter(Boolean)));

  // ฟังก์ชันบันทึกการแก้ไข
  const handleInlineEdit = async (workorderId, field, value) => {
    setWorkorders(prev => prev.map(w => w.id === workorderId ? { ...w, [field]: value } : w));
    try {
      await updateDoc(doc(db, "workorders", workorderId), { [field]: value });
      // คำนวณและอัปเดตสถิติทันทีหลังบันทึกข้อมูล workorder
      const stats = await calculateDayStats();
      setDayStats(stats);
    } catch (err) {
      // ถ้า error ให้ revert กลับ
      setWorkorders(prev => prev.map(w => w.id === workorderId ? { ...w, [field]: w[field] } : w));
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };


  // คำนวณข้อมูลสำหรับวันที่เลือก และบันทึกสถานะ busy ลง Firestore
  const calculateDayStats = async () => {
    const dayAppointments = appointments.filter(apt => apt.date === selectedDateStr);
    const currentStaffCount = dailyStaffSettings[selectedDateStr] || staffCount;
    let totalRevenue = 0;
    let totalDuration = 0;
    selectedDayWorkorders.forEach(wo => {
      const service = services.find(s => s.serviceName === wo.workorder || s.name === wo.workorder);
      const price = wo.price !== undefined && wo.price !== null && wo.price !== '' ? Number(wo.price) : (service?.price || 0);
      totalRevenue += price;
      totalDuration += service?.duration || 0;
    });
    const avgProductivity = currentStaffCount > 0 ? totalRevenue / currentStaffCount : 0;
    // ถ้า totalRevenue > productivityThreshold * currentStaffCount ให้ถือว่าไม่ว่าง
    const isBusy = totalRevenue > (productivityThreshold * currentStaffCount);

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
  }, [selectedDateStr, staffCount, dailyStaffSettings, productivityThreshold]);

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

  return (
    <div className="container mx-auto px-4 py-8">
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
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
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
                value={productivityThreshold}
                onChange={e => setProductivityThreshold(Number(e.target.value))}
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
                              onChange={e => handleInlineEdit(w.id, 'processStatus', e.target.value)}
                              className={`px-2 py-1 rounded text-sm font-medium w-full ${
                                w.processStatus === 'ใหม่' ? 'bg-blue-100 text-blue-800' :
                                w.processStatus === 'กำลังดำเนินการ' ? 'bg-yellow-100 text-yellow-800' :
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
                          <td className="p-2 border">{safe(w.name)}</td>
                          {/* บริการ */}
                          <td className="p-2 border">{safe(w.workorder)}</td>
                          {/* ราคา */}
                          <td className="p-2 border text-right font-semibold text-green-600">
                            <input
                              type="number"
                              value={w.price !== undefined && w.price !== null && w.price !== '' ? w.price : ''}
                              onChange={e => handleInlineEdit(w.id, 'price', e.target.value)}
                              className="border rounded px-2 py-1 w-20 text-right text-green-700"
                              min={0}
                              placeholder="-"
                            />
                          </td>
                          {/* สถานะเก็บเงิน */}
                          <td className="p-2 border text-center">
                            <select
                              value={w.paymentStatus || ''}
                              onChange={e => handleInlineEdit(w.id, 'paymentStatus', e.target.value)}
                              className="border rounded px-2 py-1 w-full text-sm"
                            >
                              <option value="">เลือกสถานะ</option>
                              <option value="pending">เรียกเก็บเงิน</option>
                              <option value="paid">เก็บเงินแล้ว</option>
                            </select>
                          </td>
                          {/* ช่างแก้ไข inline */}
                          <td className="p-2 border font-medium text-indigo-600">
                            <select
                              value={w.beauticianName || w.responsible || ''}
                              onChange={e => handleInlineEdit(w.id, 'beauticianName', e.target.value)}
                              className="border rounded px-2 py-1 w-full"
                            >
                              <option value="">เลือกช่าง</option>
                              {beauticianNames.map(name => (
                                <option key={name} value={name}>{name}</option>
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
