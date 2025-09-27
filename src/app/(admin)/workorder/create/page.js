"use client";
import { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

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
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    // โหลดรายชื่อพนักงานสำหรับมอบหมาย
    const fetchEmployees = async () => {
      try {
        const snapshot = await getDocs(collection(db, "employees"));
        setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setEmployees([]);
      }
    };
    fetchEmployees();
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
        const allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setConfirmedBookings(allBookings);
        // เฉพาะของวันนี้
        setTodayBookings(allBookings.filter(b => b.date === todayStr));
      } catch (err) {
        setConfirmedBookings([]);
        setTodayBookings([]);
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
      setForm(prev => ({
        ...prev,
        name: booking.fullName || booking.customerName || '',
        contact: booking.phone || '',
        address: booking.address || '',
        village: booking.village || '',
        userIDline: booking.lineUserId || '',
        date: booking.date || '',
        note: booking.note || '',
        detail: booking.serviceName ? `บริการ: ${booking.serviceName}${booking.addOnNames ? ' | เสริม: ' + booking.addOnNames.join(', ') : ''}` : '',
      }));
    }
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

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: ส่งข้อมูลไปยัง backend หรือ firebase
    alert("สร้างงานใหม่สำเร็จ! (ตัวอย่าง)");
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
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">สร้างงานใหม่</h1>
      {/* การ์ดแสดงการนัดหมายของวันปัจจุบัน */}
      {todayBookings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-indigo-700">การนัดหมายวันนี้</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayBookings.map(b => (
              <div key={b.id} className="bg-white border border-indigo-100 rounded-lg shadow p-4">
                <div className="mt-4 flex gap-2">
                  <button
                    className="bg-indigo-600 text-white px-4 py-1 rounded hover:bg-indigo-700 text-sm font-semibold"
                    onClick={() => setShowAssignFormId(b.id)}
                  >
                    สร้างงานจากนัดหมายนี้
                  </button>
                </div>
                {showAssignFormId === b.id && (
                  <form
                    className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded"
                    onSubmit={e => {
                      e.preventDefault();
                      // TODO: ส่งข้อมูลสร้างงานจริง พร้อม assign employee
                      alert(`สร้างงานและมอบหมายพนักงานสำเร็จ! (พนักงาน: ${assignEmployeeId})`);
                      setShowAssignFormId("");
                      setAssignEmployeeId("");
                    }}
                  >
                    <div className="mb-2 font-bold text-indigo-700">มอบหมายพนักงานสำหรับงานนี้</div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">เลือกพนักงาน</label>
                    <select
                      className="w-full p-2 border rounded mb-4"
                      value={assignEmployeeId}
                      onChange={e => setAssignEmployeeId(e.target.value)}
                      required
                    >
                      <option value="">-- เลือกพนักงาน --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName || emp.name || emp.firstName + ' ' + (emp.lastName || '')}</option>
                      ))}
                    </select>
                    <button type="submit" className="bg-green-600 text-white px-4 py-1 rounded font-semibold hover:bg-green-700">บันทึกงานและมอบหมาย</button>
                    <button type="button" className="ml-2 text-gray-500 underline" onClick={() => setShowAssignFormId("")}>ยกเลิก</button>
                  </form>
                )}
                <div className="font-bold text-lg text-indigo-800 mb-2">{b.fullName || b.customerName || b.customerInfo?.fullName || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>เบอร์:</b> {b.phone || b.customerPhone || b.customerInfo?.phone || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>LINE:</b> {b.lineUserId || b.customerInfo?.lineUserId || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>เวลา:</b> {b.date || '-'} {b.time || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>บริการ:</b> {b.serviceName || b.serviceInfo?.name || '-'}</div>
                {b.addOnNames && b.addOnNames.length > 0 && (
                  <div className="text-sm text-gray-700 mb-1"><b>บริการเสริม:</b> {b.addOnNames.join(', ')}</div>
                )}
                {b.serviceInfo?.addOns && Array.isArray(b.serviceInfo.addOns) && b.serviceInfo.addOns.length > 0 && (
                  <div className="text-sm text-gray-700 mb-1"><b>บริการเสริม:</b> {b.serviceInfo.addOns.map(a => a.name).join(', ')}</div>
                )}
                <div className="text-sm text-gray-700 mb-1"><b>หมายเหตุ:</b> {b.note || b.customerNote || b.customerInfo?.note || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>ที่อยู่:</b> {b.address || b.customerInfo?.address || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>หมู่บ้าน:</b> {b.village || b.customerInfo?.village || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>แต้มสะสม:</b> {b.totalPoints || b.customerInfo?.totalPoints || '-'}</div>
                <div className="text-sm text-gray-700 mb-1"><b>ช่าง:</b> {b.beauticianInfo?.firstName ? `${b.beauticianInfo.firstName} ${b.beauticianInfo.lastName || ''}` : (b.beauticianName || '-')}</div>
                <div className="text-xs text-gray-400">Booking ID: {b.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ฟอร์มสร้างงาน */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">เลือกการจองที่ยืนยันแล้ว</label>
          <select onChange={handleBookingSelect} className="w-full p-2 border rounded-md mb-4" value={selectedBookingId}>
            <option value="">-- เลือกการจอง --</option>
            {confirmedBookings.map(b => (
              <option key={b.id} value={b.id}>{b.fullName || b.customerName} | {b.phone} | {b.date} {b.time}</option>
            ))}
          </select>
          {selectedBooking && (
            <div className="bg-gray-50 p-4 rounded mb-4 text-sm">
              <div><b>ชื่อ:</b> {selectedBooking.fullName || selectedBooking.customerName}</div>
              <div><b>เบอร์:</b> {selectedBooking.phone}</div>
              <div><b>วันที่:</b> {selectedBooking.date} <b>เวลา:</b> {selectedBooking.time}</div>
              <div><b>บริการ:</b> {selectedBooking.serviceName}</div>
              {selectedBooking.addOnNames && selectedBooking.addOnNames.length > 0 && (
                <div><b>บริการเสริม:</b> {selectedBooking.addOnNames.join(', ')}</div>
              )}
              <div><b>หมายเหตุ:</b> {selectedBooking.note}</div>
            </div>
          )}
          <label className="block mb-2 text-sm font-medium text-gray-700">รหัสงาน</label>
          <input name="idKey" value={form.idKey} onChange={handleChange} className="w-full p-2 border rounded-md" required />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">งาน</label>
          <input name="workorder" value={form.workorder} onChange={handleChange} className="w-full p-2 border rounded-md" required />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">สถานะ</label>
          <input name="processStatus" value={form.processStatus} onChange={handleChange} className="w-full p-2 border rounded-md" required />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">ชื่อช่าง</label>
          <input name="responsible" value={form.responsible} onChange={handleChange} className="w-full p-2 border rounded-md" />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">วันที่</label>
          <input name="date" value={form.date} onChange={handleChange} className="w-full p-2 border rounded-md" />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">ผู้รับผิดชอบ</label>
          <input name="name" value={form.name} onChange={handleChange} className="w-full p-2 border rounded-md" />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">รายละเอียด</label>
          <textarea name="detail" value={form.detail} onChange={handleChange} className="w-full p-2 border rounded-md" rows={3} />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">หมายเหตุ</label>
          <input name="note" value={form.note} onChange={handleChange} className="w-full p-2 border rounded-md" />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">ที่อยู่</label>
          <input name="address" value={form.address} onChange={handleChange} className="w-full p-2 border rounded-md" />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">หมู่บ้าน</label>
          <input name="village" value={form.village} onChange={handleChange} className="w-full p-2 border rounded-md" />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">เบอร์ติดต่อ</label>
          <input name="contact" value={form.contact} onChange={handleChange} className="w-full p-2 border rounded-md" />
          <label className="block mt-4 mb-2 text-sm font-medium text-gray-700">ลิงก์แผนที่</label>
          <input name="mapLink" value={form.mapLink} onChange={handleChange} className="w-full p-2 border rounded-md" />
        </div>
        <div className="md:col-span-2 flex justify-end mt-6">
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-indigo-700">สร้างงาน</button>
        </div>
      </form>
    </div>
  );
}
