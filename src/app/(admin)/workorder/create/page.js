"use client";
import { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";

export default function CreateWorkorderPage() {
  const [form, setForm] = useState({
    idKey: "",
    workorder: "",
    processStatus: "",
    status: "",
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
  const [confirmedBookings, setConfirmedBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [todayBookings, setTodayBookings] = useState([]);
  const [showAssignFormId, setShowAssignFormId] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignCase, setAssignCase] = useState("");
  const [beauticians, setBeauticians] = useState([]);
  const [bookingCustomers, setBookingCustomers] = useState({});
  const [allCustomers, setAllCustomers] = useState([]);
  const [createdWorkorders, setCreatedWorkorders] = useState({});
  
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
    // โหลดรายชื่อช่างสำหรับมอบหมาย
    const fetchBeauticians = async () => {
      try {
        const snapshot = await getDocs(collection(db, "beauticians"));
        setBeauticians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setBeauticians([]);
      }
    };
    fetchBeauticians();
    const fetchBookings = async () => {
      try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        
        // ดึงทั้งหมดที่ confirmed
        const q = query(collection(db, "appointments"), where("status", "==", "confirmed"));
        const snapshot = await getDocs(q);
        let allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // เพิ่มข้อมูลจำลองสำหรับทดสอบ
        if (allBookings.length === 0) {
          console.log("เพิ่มข้อมูลจำลองสำหรับทดสอบ");
          allBookings = [
            {
              id: "test-booking-1",
              phone: "0826455346",
              fullName: "วิณ ชาติ์",
              date: todayStr,
              time: "10:00",
              serviceName: "ตัดผม",
              status: "confirmed",
              note: "ทดสอบการจับคู่"
            },
            {
              id: "test-booking-2",
              phone: "826455346", // ไม่มี 0 หน้า
              fullName: "ทดสอบ 2",
              date: todayStr,
              time: "14:00",
              serviceName: "นวดหัว",
              status: "confirmed",
              note: "ทดสอบเบอร์ไม่มี 0"
            }
          ];
        }
        
        // ดึงข้อมูลลูกค้าสำหรับแต่ละการจอง
        const customerSnapshot = await getDocs(collection(db, "customers"));
        const customers = customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // เก็บข้อมูลลูกค้าทั้งหมด
        setAllCustomers(customers);
        
        // จับคู่ข้อมูลลูกค้ากับการจอง
        const bookingsWithCustomers = {};
        console.log("=== DEBUG: จับคู่ข้อมูลลูกค้า ===");
        console.log("จำนวนลูกค้าทั้งหมด:", customers.length);
        console.log("จำนวนการจองทั้งหมด:", allBookings.length);
        
        // ฟังก์ชันปรับเบอร์โทรให้เป็นมาตรฐาน
        const normalizePhone = (phone) => {
          if (!phone) return "";
          const cleaned = phone.toString().replace(/[^\d]/g, "");
          // ลองหลายแบบ: เต็ม, ตัด 0 หน้า, เพิ่ม 66
          return [
            cleaned,
            cleaned.replace(/^0/, ""),
            cleaned.replace(/^0/, "66"),
            cleaned.length === 9 ? "0" + cleaned : cleaned
          ];
        };
        
        allBookings.forEach(booking => {
          // อ่านเบอร์โทรจากหลายที่ที่เป็นไปได้ในโครงสร้างข้อมูล
          const phone = booking.phone || 
                       booking.customerInfo?.phone || 
                       booking.customerPhone ||
                       booking.contact ||
                       "";
          
          const bookingPhones = normalizePhone(phone);
          console.log(`การจอง ${booking.id}: เบอร์ ${phone} -> normalized:`, bookingPhones);
          console.log(`รายละเอียดการจอง:`, {
            phone: booking.phone,
            customerInfo: booking.customerInfo,
            customerPhone: booking.customerPhone,
            contact: booking.contact
          });
          
          let foundCustomer = null;
          if (phone) { // มีเบอร์โทรศัพท์
            for (const customer of customers) {
              const customerPhones = normalizePhone(customer.phone || customer.contact || "");
              // ตรวจสอบว่าเบอร์ใดๆ ของการจองตรงกับเบอร์ใดๆ ของลูกค้าไหม
              if (bookingPhones.some(bp => bp && customerPhones.includes(bp))) {
                foundCustomer = customer;
                console.log(`✓ พบลูกค้าที่ตรงกัน: ${customer.id} (${customer.fullName}) เบอร์: ${customer.phone}`);
                break;
              }
            }
          }
          
          // ลองจับคู่จาก customerId ถ้ามี
          if (!foundCustomer && booking.customerInfo?.customerId) {
            foundCustomer = customers.find(c => c.id === booking.customerInfo.customerId);
            if (foundCustomer) {
              console.log(`✓ พบลูกค้าจาก customerId: ${foundCustomer.id} (${foundCustomer.fullName})`);
            }
          }
          
          // ลองจับคู่จากชื่อเต็มถ้ายังไม่เจอ
          if (!foundCustomer && (booking.customerInfo?.fullName || booking.fullName)) {
            const bookingName = booking.customerInfo?.fullName || booking.fullName || "";
            foundCustomer = customers.find(c => {
              const customerName = c.fullName || c.name || "";
              return bookingName && customerName && bookingName.includes(customerName.trim());
            });
            if (foundCustomer) {
              console.log(`✓ พบลูกค้าจากชื่อ: ${foundCustomer.id} (${foundCustomer.fullName})`);
            }
          }
          
          if (!foundCustomer) {
            console.log(`✗ ไม่พบลูกค้าสำหรับการจอง ${booking.id} เบอร์ ${phone}`);
            console.log(`   ข้อมูลการจองที่ใช้หา:`, {
              phone,
              customerId: booking.customerInfo?.customerId,
              fullName: booking.customerInfo?.fullName || booking.fullName
            });
          }
          
          bookingsWithCustomers[booking.id] = foundCustomer;
        });
        
        setBookingCustomers(bookingsWithCustomers);
        setConfirmedBookings(allBookings);
        // เฉพาะของวันนี้
        setTodayBookings(allBookings.filter(b => b.date === todayStr));
      } catch (err) {
        setConfirmedBookings([]);
        setTodayBookings([]);
        setBookingCustomers({});
      }
    };
    fetchBookings();
  }, []);
  const handleBookingSelect = (e) => {
    const bookingId = e.target.value;
    setSelectedBookingId(bookingId);
    const booking = confirmedBookings.find(b => b.id === bookingId);
    setSelectedBooking(booking || null);
    if (booking) {
      setForm({});
    }
    window.selectedCustomer = null;
  };

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
    try {
      // ตรวจสอบและ map ข้อมูลให้ครบทุกฟิลด์สำคัญ
      const workorderData = {
        idKey: form.idKey || new Date().getTime().toString(),
        workorder: form.workorder || (selectedBooking?.serviceName || ""),
        processStatus: form.processStatus || "ใหม่",
        responsible: form.responsible || (beauticians.find(b => b.id === assignEmployeeId)?.fullName || ""),
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
        status: form.status || "",
        userIDresponsible: form.userIDresponsible || "",
        userIDline: form.userIDline || "",
        beauticianId: assignEmployeeId || "",
        caseNumber: assignCase || ""
      };
      await addDoc(collection(db, "workorders"), workorderData);
      alert("สร้างงานใหม่สำเร็จ!");
      setForm({
        idKey: "",
        workorder: "",
        processStatus: "",
        status: "",
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
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึกงาน");
    }
  };

  const handleCreateWorkorderFromBooking = async (booking, beauticianId, caseNumber) => {
    try {
      const beautician = beauticians.find(b => b.id === beauticianId);
      const customer = bookingCustomers[booking.id];
      
      await addDoc(collection(db, "workorders"), {
        idKey: booking.id || new Date().getTime().toString(),
        workorder: booking.serviceName || "บริการทั่วไป",
        processStatus: "ใหม่",
        responsible: beautician?.fullName || beautician?.name || beautician?.firstName + ' ' + (beautician?.lastName || '') || "",
        date: booking.date || new Date().toISOString().slice(0, 10),
        time: booking.time || "",
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
        status: "รอดำเนินการ",
        userIDresponsible: "",
        userIDline: booking.lineUserId || customer?.userId || "",
        beauticianId: beauticianId,
        beauticianName: beautician?.fullName || beautician?.name || beautician?.firstName + ' ' + (beautician?.lastName || '') || "",
        caseNumber: caseNumber,
        customerPoints: customer?.points || customer?.totalPoints || 0,
        bookingId: booking.id,
        createdAt: new Date().toISOString()
      });
      alert("สร้างงานจากการนัดหมายสำเร็จ!");
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการสร้างงานจากการนัดหมาย");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">สร้างงานใหม่</h1>
      {/* การ์ดแสดงการนัดหมายของวันปัจจุบัน */}
      {todayBookings.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-indigo-700">การนัดหมายวันนี้</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayBookings.map((b, idx) => (
              <div key={b.id ? b.id + '-' + idx : idx} className="bg-white border border-indigo-100 rounded-lg shadow p-4">
                <div className="mt-4 flex gap-2">
                  <div className="flex items-center gap-2">
                             {createdWorkorders[b.id] && (
                      <span title="สร้างงานแล้ว" className="inline-block text-green-600 text-xl align-middle">
                        ✓
                      </span>
                    )}
                    <button
                      className="bg-indigo-600 text-white px-4 py-1 rounded hover:bg-indigo-700 text-sm font-semibold"
                      onClick={() => setShowAssignFormId(b.id)}
                    >
                      สร้างงานจากนัดหมายนี้
                    </button>
           
                  </div>
                  {bookingCustomers[b.id] && (
                    <button
                      className="bg-yellow-500 text-white px-4 py-1 rounded hover:bg-yellow-600 text-sm font-semibold"
                      onClick={() => {
                        // ไปหน้าแก้ไขข้อมูลลูกค้า (เช่น /admin/customers/edit/[id])
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
                      await handleCreateWorkorderFromBooking(b, assignEmployeeId, assignCase);
                      setShowAssignFormId("");
                      setAssignEmployeeId("");
                      setAssignCase("");
                    }}
                  >
                    <div className="mb-2 font-bold text-indigo-700">มอบหมายช่างสำหรับงานนี้</div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">เลือกช่าง</label>
                    <select
                      className="w-full p-2 border rounded mb-4"
                      value={assignEmployeeId}
                      onChange={e => setAssignEmployeeId(e.target.value)}
                      required
                    >
                      <option value="">-- เลือกช่าง --</option>
                      {beauticians.map((beauty, idx) => (
                        <option key={beauty.id ? beauty.id + '-' + idx : idx} value={beauty.id}>{beauty.fullName || beauty.name || beauty.firstName + ' ' + (beauty.lastName || '')}</option>
                      ))}
                    </select>
                    <label className="block mb-2 text-sm font-medium text-gray-700">เคสที่</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded mb-4"
                      value={assignCase}
                      onChange={e => setAssignCase(e.target.value)}
                      placeholder="ระบุเคสที่ (เช่น 1, 2, 3)"
                      required
                    />
                    <button type="submit" className="bg-green-600 text-white px-4 py-1 rounded font-semibold hover:bg-green-700">บันทึกงานและมอบหมาย</button>
                    <button type="button" className="ml-2 text-gray-500 underline" onClick={() => { setShowAssignFormId(""); setAssignEmployeeId(""); setAssignCase(""); }}>ยกเลิก</button>
                  </form>
                )}
                {(() => {
                  const customer = bookingCustomers[b.id];
                  
                  // อ่านข้อมูลจากการจองตามโครงสร้างจริง
                  const bookingPhone = b.phone || b.customerInfo?.phone || b.customerPhone || b.contact || '';
                  const bookingName = b.fullName || b.customerInfo?.fullName || b.customerName || '';
                  const bookingLineId = b.lineUserId || b.customerInfo?.lineUserId || '';
                  
                  const displayName = bookingName || customer?.fullName || customer?.name || 'ไม่ระบุชื่อ';
                  const displayPhone = bookingPhone || customer?.phone || 'ไม่ระบุเบอร์';
                  const displayAddress = customer?.address || b.address || b.customerInfo?.address || 'ไม่ระบุที่อยู่';
                  const displayVillage = customer?.village || b.village || b.customerInfo?.village || 'ไม่ระบุหมู่บ้าน';
                  const displayPoints = customer?.points || customer?.totalPoints || 0;
                  const displayNote = b.note || b.customerInfo?.note || customer?.note || 'ไม่มีหมายเหตุ';
                  const displayLineId = bookingLineId || customer?.userId || customer?.lineUserId || 'ไม่มี LINE ID';
                  
                  return (
                    <>
                      <div className="font-bold text-lg text-indigo-800 mb-2">{displayName}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>เบอร์:</b> {displayPhone}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>LINE:</b> {displayLineId}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>เวลา:</b> {b.date || 'ไม่ระบุวันที่'} {b.time || b.dateTime || 'ไม่ระบุเวลา'}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>บริการ:</b> {b.serviceName || b.serviceInfo?.name || 'ไม่ระบุบริการ'}</div>
                      {b.addOnNames && b.addOnNames.length > 0 && (
                        <div className="text-sm text-gray-700 mb-1"><b>บริการเสริม:</b> {b.addOnNames.join(', ')}</div>
                      )}
                      {b.addOns && Array.isArray(b.addOns) && b.addOns.length > 0 && (
                        <div className="text-sm text-gray-700 mb-1"><b>บริการเสริม:</b> {b.addOns.map(a => a.name).join(', ')}</div>
                      )}
                      <div className="text-sm text-gray-700 mb-1"><b>หมายเหตุ:</b> {displayNote}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>ที่อยู่:</b> {displayAddress}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>หมู่บ้าน:</b> {displayVillage}</div>
                      <div className="text-sm text-gray-700 mb-1"><b>แต้มสะสม:</b> <span className="font-semibold text-green-600">{displayPoints} แต้ม</span></div>
                      <div className="text-sm text-gray-700 mb-1"><b>ช่าง:</b> {b.beauticianInfo?.firstName ? `${b.beauticianInfo.firstName} ${b.beauticianInfo.lastName || ''}` : (b.beauticianName || 'ไม่ระบุช่าง')}</div>
                      {customer && (
                        <div className="text-xs text-green-600 mt-2">✓ พบข้อมูลลูกค้าในระบบ</div>
                      )}
                      {!customer && (
                        <div className="text-xs text-orange-600 mt-2">⚠ ไม่พบข้อมูลลูกค้าในระบบ</div>
                      )}
                    </>
                  );
                })()}
                <div className="text-xs text-gray-400 mt-2 border-t pt-2">
                  <div>Booking ID: {b.id}</div>
                  <div>Booking Phone: {b.phone || b.customerInfo?.phone || 'ไม่มี'}</div>
                  <div>Customer ID (from booking): {b.customerInfo?.customerId || 'ไม่มี'}</div>
                  {bookingCustomers[b.id] && (
                    <>
                      <div className="text-green-600">✓ Found Customer ID: {bookingCustomers[b.id].id}</div>
                      <div>Customer Phone: {bookingCustomers[b.id].phone}</div>
                    </>
                  )}
                  {!bookingCustomers[b.id] && (
                    <div className="text-red-600">✗ ไม่พบข้อมูลลูกค้า</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 text-center text-gray-400">ไม่พบการนัดหมายที่ยืนยันแล้วสำหรับวันนี้</div>
      )}
      {/* ฟอร์มสร้างงานถูกลบออก */}
    </div>
  );
}
