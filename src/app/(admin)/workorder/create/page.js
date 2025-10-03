"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where, addDoc, orderBy } from "firebase/firestore";
import { sendWorkorderConfirmedFlex } from '@/app/actions/workorderActions';
import { sendBookingNotification } from '@/app/actions/lineActions';
import { useRouter } from "next/navigation";
import { useToast } from '@/app/components/Toast';
import { format, startOfDay, endOfDay, parseISO } from "date-fns";

const STATUSES = {
  awaiting_confirmation: { label: 'รอยืนยัน', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'ยืนยันแล้ว', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'กำลังใช้บริการ', color: 'bg-purple-100 text-purple-800' },
  completed: { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
};

const STATUS_OPTIONS = [
  { key: '', label: 'ทุกสถานะ' },
  ...Object.entries(STATUSES).map(([key, val]) => ({ key, label: val.label }))
];

export default function CreateWorkorderPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    idKey: "",
    workorder: "",
    processStatus: "",
    status: "confirmed",
    name: "",
    address: "",
    village: "",
    contact: "",
    payment: "",
    mapLink: "",
    note: "",
    detail: "",
    adminNote: "",
    admin: "",
    date: "",
    userIDresponsible: "",
    userIDline: "",
    responsible: ""
  });

  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [allBookings, setAllBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showAssignFormId, setShowAssignFormId] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignCase, setAssignCase] = useState("");
  const [assignDate, setAssignDate] = useState("");
  const [assignTime, setAssignTime] = useState("");
  const [assignPrice, setAssignPrice] = useState("");
  const [gardeners, setGardeners] = useState([]);
  const [bookingCustomers, setBookingCustomers] = useState({});
  const [allCustomers, setAllCustomers] = useState([]);
  const [createdWorkorders, setCreatedWorkorders] = useState({});

  // ฟิลเตอร์
  const getMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: format(firstDay, 'yyyy-MM-dd'),
      endDate: format(lastDay, 'yyyy-MM-dd'),
    };
  };
  const [filters, setFilters] = useState({
    ...getMonthRange(),
    search: '',
    status: 'awaiting_confirmation',
  });

  useEffect(() => {
    // โหลดงานที่สร้างแล้ว
    const fetchCreatedWorkorders = async () => {
      try {
        const snapshot = await getDocs(collection(db, "workorders"));
        const workorders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // สร้าง map จาก bookingId
        const map = {};
        workorders.forEach(w => {
          if (w.bookingId) map[w.bookingId] = true;
        });
        setCreatedWorkorders(map);
      } catch (err) {
        setCreatedWorkorders({});
      }
    };
    fetchCreatedWorkorders();
    // โหลดรายชื่อช่าง (gardeners) สำหรับมอบหมาย
    const fetchGardeners = async () => {
      try {
        const snapshot = await getDocs(collection(db, "gardeners"));
        setGardeners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setGardeners([]);
      }
    };
    fetchGardeners();
    const fetchBookings = async () => {
      try {
        // ดึงนัดหมายทั้งหมด (ทุกสถานะ)
        const q = query(collection(db, "appointments"), orderBy("appointmentInfo.dateTime", "desc"));
        const snapshot = await getDocs(q);
        let bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // ดึงข้อมูลลูกค้าสำหรับแต่ละการจอง
        const customerSnapshot = await getDocs(collection(db, "customers"));
        const customers = customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllCustomers(customers);
        // จับคู่ข้อมูลลูกค้ากับการจอง
        const bookingsWithCustomers = {};
        const normalizePhone = (phone) => {
          if (!phone) return "";
          const cleaned = phone.toString().replace(/[^\d]/g, "");
          return [
            cleaned,
            cleaned.replace(/^0/, ""),
            cleaned.replace(/^0/, "66"),
            cleaned.length === 9 ? "0" + cleaned : cleaned
          ];
        };
        bookings.forEach(booking => {
          const phone = booking.phone || booking.customerInfo?.phone || booking.customerPhone || booking.contact || "";
          const bookingPhones = normalizePhone(phone);
          let foundCustomer = null;
          if (phone) {
            for (const customer of customers) {
              const customerPhones = normalizePhone(customer.phone || customer.contact || "");
              if (bookingPhones.some(bp => bp && customerPhones.includes(bp))) {
                foundCustomer = customer;
                break;
              }
            }
          }
          if (!foundCustomer && booking.customerInfo?.customerId) {
            foundCustomer = customers.find(c => c.id === booking.customerInfo.customerId);
          }
          if (!foundCustomer && (booking.customerInfo?.fullName || booking.fullName)) {
            const bookingName = booking.customerInfo?.fullName || booking.fullName || "";
            foundCustomer = customers.find(c => {
              const customerName = c.fullName || c.name || "";
              return bookingName && customerName && bookingName.includes(customerName.trim());
            });
          }
          bookingsWithCustomers[booking.id] = foundCustomer;
        });
        setBookingCustomers(bookingsWithCustomers);
        setAllBookings(bookings);
      } catch (err) {
        setAllBookings([]);
        setBookingCustomers({});
      }
    };
    fetchBookings();
  }, []);
  // ฟังก์ชันกรอง
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // กรองรายการนัดหมาย
  const filteredBookings = useMemo(() => {
    const startDate = startOfDay(parseISO(filters.startDate));
    const endDate = endOfDay(parseISO(filters.endDate));
    const search = filters.search.toLowerCase();
    const status = filters.status;
    return allBookings.filter(app => {
      // วันที่
      const appDate = app.appointmentInfo?.dateTime?.toDate?.() || app.date ? new Date(app.appointmentInfo?.dateTime?.toDate?.() || app.date) : null;
      if (!appDate || appDate < startDate || appDate > endDate) return false;
      // สถานะ
      if (status && app.status !== status) return false;
      // ค้นหา
      if (search &&
        !(app.customerInfo?.fullName?.toLowerCase().includes(search) ||
          app.customerInfo?.phone?.includes(search) ||
          app.fullName?.toLowerCase().includes(search) ||
          app.phone?.includes(search))) return false;
      return true;
    });
  }, [allBookings, filters]);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const snapshot = await getDocs(collection(db, "customers"));
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setCustomers([]);
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomerSelect = (e) => {
    const customerId = e.target.value;
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setForm(prev => ({
        ...prev,
        name: customer.fullName || '',
        contact: customer.phone || '',
        address: customer.address || '',
        village: customer.village || '',
        userIDline: customer.userId || '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[DEBUG] เริ่มสร้างงานใหม่ (manual)');
    try {
      // ตรวจสอบและ map ข้อมูลให้ครบทุกฟิลด์สำคัญ
      const workorderData = {
        idKey: form.idKey || new Date().getTime().toString(),
        workorder: form.workorder || (selectedBooking?.serviceName || ""),
        processStatus: form.processStatus || "ใหม่",
        responsible: form.responsible || (gardeners.find(g => g.id === assignEmployeeId)?.fullName || ""),
        date: form.date || new Date().toISOString().slice(0, 10),
        name: form.name || (selectedBooking?.fullName || ""),
        detail: form.detail || (selectedBooking?.detail || ""),
        note: form.note || (selectedBooking?.note || ""),
        address: form.address || (selectedBooking?.address || ""),
        village: form.village || (selectedBooking?.village || ""),
        contact: form.contact || (selectedBooking?.phone || ""),
        payment: form.payment || "",
        mapLink: form.mapLink || "",
        adminNote: form.adminNote || "",
        admin: form.admin || "",
        status: "confirmed",
        userIDresponsible: form.userIDresponsible || "",
        userIDline: form.userIDline || "",
        gardenerId: assignEmployeeId || "",
        caseNumber: assignCase || "",
        bookingId: selectedBooking?.id || ""
      };
      const docRef = await addDoc(collection(db, "workorders"), workorderData);
      // ส่ง Flex Message สถานะยืนยันแล้ว
      if (form.userIDline) {
        console.log('[CREATE][Flex] เรียกส่ง Flex ไปยัง userIDline:', form.userIDline, workorderData);
        try {
          await sendWorkorderConfirmedFlex(form.userIDline, workorderData);
          console.log('[CREATE][Flex] ส่ง Flex สำเร็จ');
        } catch (flexErr) {
          console.error('[CREATE][Flex] ERROR', flexErr);
        }
      }

      // แจ้งเตือนแอดมินเมื่อสร้างงานใหม่
      try {
        const notificationData = {
          customerName: workorderData.name || 'ลูกค้า',
          serviceName: workorderData.workorder || 'งานใหม่',
          appointmentDate: workorderData.date || new Date().toISOString().slice(0, 10),
          appointmentTime: workorderData.time || '',
          totalPrice: workorderData.payment ? parseInt(workorderData.payment) : 0,
          staffName: workorderData.responsible || 'พนักงาน'
        };
        console.log('[CREATE] เตรียมแจ้งเตือนแอดมิน (งานใหม่):', notificationData);
        await sendBookingNotification(notificationData, 'workorderCreated');
        console.log('[CREATE] แจ้งเตือนแอดมินสำเร็จ');
      } catch (adminNotifyErr) {
        console.error('[CREATE] แจ้งเตือนแอดมิน ERROR', adminNotifyErr);
      }

  showToast("สร้างงานใหม่สำเร็จ!", "success");
      // redirect ไปหน้า workorder
      // ไปยังหน้ารายวันของวันที่นัดหมาย
      const gotoDate = workorderData.date || new Date().toISOString().slice(0, 10);
      router.push(`/workorder?date=${gotoDate}`);
    } catch (err) {
  showToast("เกิดข้อผิดพลาดในการบันทึกงาน", "error");
    }
  };

  const handleCreateWorkorderFromBooking = async (booking, gardenerId, caseNumber, date, time, price) => {
    console.log('[DEBUG] เริ่มสร้างงานจากนัดหมาย:', { bookingId: booking.id, gardenerId, caseNumber });
    try {
      const gardener = gardeners.find(g => g.id === gardenerId);
      const customer = bookingCustomers[booking.id];
      // ใช้ชื่อบริการจาก serviceInfo.name ก่อน fallback เป็น serviceName หรือ 'บริการทั่วไป'
      const serviceName = booking.serviceInfo?.name || booking.serviceName || "บริการทั่วไป";
      const docRef = await addDoc(collection(db, "workorders"), {
        idKey: booking.id || new Date().getTime().toString(),
        workorder: serviceName,
        processStatus: "ใหม่",
        responsible: gardener?.fullName || gardener?.name || gardener?.firstName + ' ' + (gardener?.lastName || '') || "",
        date: date || booking.date || new Date().toISOString().slice(0, 10),
        time: time || booking.time || "",
        price: price || booking.price || booking.serviceInfo?.price || "",
        name: booking.fullName || booking.customerName || customer?.fullName || "",
        detail: `บริการ: ${booking.serviceName || ''}${booking.addOnNames ? ' | เสริม: ' + booking.addOnNames.join(', ') : ''}`,
        note: booking.note || customer?.note || "",
        address: customer?.address || booking.address || "",
        village: customer?.village || booking.village || "",
        contact: booking.phone || customer?.phone || "",
        payment: "",
        mapLink: customer?.mapLink || "",
        adminNote: "",
        admin: "",
        status: "confirmed",
        userIDresponsible: "",
        userIDline: booking.lineUserId || customer?.userId || "",
        gardenerId: gardenerId,
        gardenerName: gardener?.fullName || gardener?.name || gardener?.firstName + ' ' + (gardener?.lastName || '') || "",
        caseNumber: caseNumber,
        bookingId: booking.id,
        createdAt: new Date().toISOString()
      });
      // อัพเดทสถานะนัดหมายเป็น confirmed
      if (booking.id) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const appointmentRef = doc(db, "appointments", booking.id);
        await updateDoc(appointmentRef, { status: "confirmed" });
        // อัพเดทใน state ทันที
        setAllBookings(prev => prev.map(bk => bk.id === booking.id ? { ...bk, status: "confirmed" } : bk));
      }
      // ส่ง Flex Message สถานะยืนยันแล้ว (ถ้ามี LINE ID)
      const lineId = booking.lineUserId || customer?.userId || "";
      if (lineId) {
        // สร้าง payload ที่เป็น plain object และมีข้อมูลจากฟอร์มที่กรอก (เพราะอาจมีการเปลี่ยนแปลง)
        const flexPayload = {
          serviceName: serviceName,
          date: date || booking.date || '',
          time: time || booking.time || '',
          appointmentId: booking?.id || '',
          id: booking?.id || '',
          // ข้อมูลจากฟอร์ม (ที่อาจเปลี่ยนแปลง)
          gardenerName: gardener?.fullName || gardener?.name || gardener?.firstName + ' ' + (gardener?.lastName || '') || '',
          caseNumber: caseNumber || '',
          price: price || booking.price || booking.serviceInfo?.price || '',
        };
        // เพิ่ม customerInfo ถ้ามี
        if (booking?.customerInfo?.fullName || booking?.fullName || customer?.fullName) {
          flexPayload.customerInfo = {
            fullName: booking?.customerInfo?.fullName || booking?.fullName || customer?.fullName || '',
          };
          if (booking?.customerInfo?.phone || booking?.phone || customer?.phone) {
            flexPayload.customerInfo.phone = booking?.customerInfo?.phone || booking?.phone || customer?.phone || '';
          }
        }
        // เพิ่ม serviceInfo ถ้ามี
        if (serviceName) {
          flexPayload.serviceInfo = { name: serviceName };
        }
        console.log('[CREATE][Flex] เรียกส่ง Flex จากนัดหมายไปยัง userIDline:', lineId, flexPayload);
        try {
          await sendWorkorderConfirmedFlex(lineId, flexPayload);
          console.log('[CREATE][Flex] ส่ง Flex สำเร็จ (จากนัดหมาย)');
        } catch (flexErr) {
          console.error('[CREATE][Flex] ERROR (จากนัดหมาย)', flexErr);
        }
      }

      // แจ้งเตือนแอดมินเมื่อสร้างงานจากนัดหมาย
      try {
        const notificationData = {
          customerName: booking.fullName || booking.customerInfo?.fullName || customer?.fullName || 'ลูกค้า',
          serviceName: serviceName,
          appointmentDate: date || booking.date || new Date().toISOString().slice(0, 10),
          appointmentTime: time || booking.time || '',
          totalPrice: price ? parseInt(price) : (booking.price ? parseInt(booking.price) : 0),
          staffName: gardener?.fullName || gardener?.name || gardener?.firstName + ' ' + (gardener?.lastName || '') || 'พนักงาน',
          caseNumber: caseNumber || ''
        };
        console.log('[CREATE] เตรียมแจ้งเตือนแอดมิน (จากนัดหมาย):', notificationData);
        await sendBookingNotification(notificationData, 'workorderAssigned');
        console.log('[CREATE] แจ้งเตือนแอดมินสำเร็จ (จากนัดหมาย)');
      } catch (adminNotifyErr) {
        console.error('[CREATE] แจ้งเตือนแอดมิน ERROR (จากนัดหมาย)', adminNotifyErr);
      }

      alert("สร้างงานจากการนัดหมายสำเร็จ!");
      // redirect ไปหน้า workorder
      // ไปยังหน้ารายวันของวันที่นัดหมาย
      const gotoDate = date || booking.date || new Date().toISOString().slice(0, 10);
      router.push(`/workorder?date=${gotoDate}`);
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการสร้างงานจากการนัดหมาย");
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">สร้างงานใหม่</h1>
      {/* ฟิลเตอร์เหมือน dashboard */}
      <div className="flex flex-wrap items-center gap-4 mb-8 text-black">
        <div>
          <label className="text-sm font-medium mr-2">วันที่เริ่มต้น:</label>
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 border rounded-md" />
        </div>
        <div>
          <label className="text-sm font-medium mr-2">วันที่สิ้นสุด:</label>
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 border rounded-md" />
        </div>
        <div>
          <label className="text-sm font-medium mr-2">ค้นหา:</label>
          <input type="text" name="search" placeholder="ชื่อ หรือ เบอร์โทร" value={filters.search} onChange={handleFilterChange} className="p-2 border rounded-md" />
        </div>
        <div>
          <label className="text-sm font-medium mr-2">สถานะ:</label>
          <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 border rounded-md">
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      {/* แสดงรายการนัดหมายทุกสถานะที่ผ่านการกรอง */}
      {filteredBookings.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-indigo-700">รายการนัดหมาย</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBookings.map((b, idx) => (
              <div key={b.id ? b.id + '-' + idx : idx} className="bg-white border border-indigo-100 rounded-lg p-4">
                <div className="flex gap-2 items-center mb-2">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${STATUSES[b.status]?.color || 'bg-gray-100 text-gray-800'}`}>{STATUSES[b.status]?.label || b.status || 'ไม่ระบุสถานะ'}</span>
                  {createdWorkorders[b.id] && (
                    <span title="สร้างงานแล้ว" className="inline-block text-green-600 text-xl align-middle">✓</span>
                  )}
                  <button
                    className="bg-indigo-600 text-white px-4 py-1 rounded hover:bg-indigo-700 text-sm font-semibold"
                    onClick={() => setShowAssignFormId(b.id)}
                  >
                    สร้างงานจากนัดหมายนี้
                  </button>
                  {bookingCustomers[b.id] && (
                    <button
                      className="bg-yellow-500 text-white px-4 py-1 rounded hover:bg-yellow-600 text-sm font-semibold"
                      onClick={() => {
                        window.location.href = `/customers/edit/${bookingCustomers[b.id].id}`;
                      }}
                    >
                      แก้ไขข้อมูลลูกค้า
                    </button>
                  )}
                </div>
                {showAssignFormId === b.id && (
                  <form
                    className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded"
                    onSubmit={async e => {
                      e.preventDefault();
                      await handleCreateWorkorderFromBooking(b, assignEmployeeId, assignCase, assignDate, assignTime, assignPrice);
                      setShowAssignFormId("");
                      setAssignEmployeeId("");
                      setAssignCase("");
                      setAssignDate("");
                      setAssignTime("");
                      setAssignPrice("");
                    }}
                  >
                    <div className="mb-2 font-bold text-indigo-700">มอบหมายช่างสำหรับงานนี้</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">เคสที่</label>
                        <input
                          type="text"
                          className="w-full p-2 border rounded mb-4"
                          value={assignCase}
                          onChange={e => setAssignCase(e.target.value)}
                          placeholder="ระบุเคสที่ (เช่น 1, 2, 3)"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">เลือกช่าง</label>
                        <select
                          className="w-full p-2 border rounded mb-4"
                          value={assignEmployeeId}
                          onChange={e => setAssignEmployeeId(e.target.value)}
                          required
                        >
                          <option value="">-- เลือกช่าง --</option>
                          {gardeners.map((gardener, idx) => (
                            <option key={gardener.id ? gardener.id + '-' + idx : idx} value={gardener.id}>{gardener.fullName || gardener.name || gardener.firstName + ' ' + (gardener.lastName || '')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block mb-2 text-sm font-medium text-gray-700">ราคา</label>
                      <input
                        type="number"
                        className="w-full p-2 border rounded"
                        value={assignPrice || b.price || b.serviceInfo?.price || ""}
                        onChange={e => setAssignPrice(e.target.value)}
                        min={0}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">วันที่</label>
                        <input
                          type="date"
                          className="w-full p-2 border rounded mb-4"
                          value={assignDate || (b.date || "")}
                          onChange={e => setAssignDate(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">เวลา</label>
                        <input
                          type="time"
                          className="w-full p-2 border rounded mb-4"
                          value={assignTime || (b.time || "")}
                          onChange={e => setAssignTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-4">
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700">บันทึกงานและมอบหมาย</button>
                      <button type="button" className="bg-gray-200 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-300" onClick={() => { setShowAssignFormId(""); setAssignEmployeeId(""); setAssignCase(""); setAssignDate(""); setAssignTime(""); setAssignPrice(""); }}>ยกเลิก</button>
                    </div>
                  </form>
                )}
                {(() => {
                  const customer = bookingCustomers[b.id];
                  const bookingPhone = b.phone || b.customerInfo?.phone || b.customerPhone || b.contact || '';
                  const bookingName = b.fullName || b.customerInfo?.fullName || b.customerName || '';
                  const bookingLineId = b.lineUserId || b.customerInfo?.customerId || '';
                  const displayName = bookingName || customer?.fullName || customer?.name || 'ไม่ระบุชื่อ';
                  const displayPhone = bookingPhone || customer?.phone || 'ไม่ระบุเบอร์';
                  const displayAddress = customer?.address || b.address || b.customerInfo?.address || 'ไม่ระบุที่อยู่';
                  const displayVillage = customer?.village || b.village || b.customerInfo?.village || 'ไม่ระบุหมู่บ้าน';
                  const displayNote = b.note || b.customerInfo?.note || customer?.note || 'ไม่มีหมายเหตุ';
                  const displayLineId = bookingLineId || customer?.userId || customer?.customerId || 'ไม่มี LINE ID';
                  return (
                    <>
                      <div className="font-bold text-lg text-indigo-800 mb-2">{displayName}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>เบอร์:</b> {displayPhone}</div>
                      {/* LINE ID: show SVG icon for connection status */}
                      <div className="text-sm text-gray-700 mb-1 flex items-center gap-1">
                        <b>LINE:</b>
                        {(() => {
                          // Hide actual LINE ID, show SVG icon only
                          // If there is a valid LINE ID (not default/empty), show green connected icon
                          // If booked by admin (no LINE ID), show gray disconnected icon
                          const isConnected = !!displayLineId && displayLineId && displayLineId !== 'ไม่มี LINE ID';
                          if (isConnected) {
                            // Connected SVG (green)
                            return (
                              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="10" cy="10" r="9" fill="#22c55e" stroke="#16a34a" strokeWidth="2" />
                                <path d="M7 10.5l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            );
                          } else {
                            // Disconnected SVG (gray)
                            return (
                              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="10" cy="10" r="9" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
                                <path d="M7 13l6-6M7 7l6 6" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            );
                          }
                        })()}
                      </div>
                      <div className="text-sm text-gray-700 mb-1"><b>เวลา:</b> {
                        b.date
                          ? format(new Date(b.date), 'dd-MM-yyyy')
                          : (b.appointmentInfo?.dateTime?.toDate?.() ? format(b.appointmentInfo.dateTime.toDate(), 'dd-MM-yyyy') : '')
                      } {b.time || b.dateTime || ''}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>บริการ:</b> {b.serviceName || b.serviceInfo?.name || 'ไม่ระบุบริการ'}</div>
                      {b.addOnNames && b.addOnNames.length > 0 && (
                        <div className="text-sm text-gray-700 mb-1"><b>บริการเสริม:</b> {b.addOnNames.join(', ')}</div>
                      )}
                      {b.addOns && Array.isArray(b.addOns) && b.addOns.length > 0 && (
                        <div className="text-sm text-gray-700 mb-1"><b>บริการเสริม:</b> {b.addOns.map(a => a.name).join(', ')}</div>
                      )}
                      <div className="text-sm text-gray-700 mb-1"><b>หมายเหตุ:</b> {displayNote}</div>
                      {displayAddress !== 'ไม่ระบุที่อยู่' && (
                        <div className="text-sm text-gray-700 mb-1"><b>ที่อยู่:</b> {displayAddress}</div>
                      )}
                      {displayVillage !== 'ไม่ระบุหมู่บ้าน' && (
                        <div className="text-sm text-gray-700 mb-1"><b>หมู่บ้าน:</b> {displayVillage}</div>
                      )}
                      {((b.gardenersInfo?.firstName ? `${b.gardenersInfo.firstName} ${b.gardenersInfo.lastName || ''}` : (b.gardenerName || 'ไม่ระบุช่าง')) !== 'ไม่ระบุช่าง') && (
                        <div className="text-sm text-gray-700 mb-1"><b>ช่าง:</b> {b.gardenersInfo?.firstName ? `${b.gardenersInfo.firstName} ${b.gardenersInfo.lastName || ''}` : (b.gardenerName || 'ไม่ระบุช่าง')}</div>
                      )}
                      {customer && (
                        <div className="text-xs text-green-600 mt-2">✓ พบข้อมูลลูกค้าในระบบ</div>
                      )}
                      {!customer && (
                        <div className="text-xs text-orange-600 mt-2">⚠ ไม่พบข้อมูลลูกค้าในระบบ</div>
                      )}
                    </>
                  );
                })()}
                {/* ซ่อนข้อมูลลูกค้าที่ดึงมาจาก bookingCustomers */}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 text-center text-gray-400">ไม่พบรายการนัดหมายในช่วงวันที่ที่เลือก</div>
      )}
    </div>
  );
}
