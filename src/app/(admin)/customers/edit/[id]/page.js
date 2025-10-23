"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';

export default function EditCustomerPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    points: 0,
    userId: '',
    address: '',
    mapLink: '',
    village: '',
    detail: '',
    contact: '',
    note: '',
    credit: ''
  });
  const [latestBookingAddress, setLatestBookingAddress] = useState('');
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "customers", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            fullName: data.fullName || '',
            phone: data.phone || '',
            email: data.email || '',
            points: data.points || 0,
            userId: data.userId || '',
            address: data.address || '',
            mapLink: data.mapLink || '',
            village: data.village || '',
            detail: data.detail || '',
            contact: data.contact || '',
            note: data.note || '',
            credit: data.credit || ''
          });
        } else {
          showToast("ไม่พบข้อมูลลูกค้า", 'error');
          router.push('/customers');
        }
      } catch (error) {
        showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", 'error');
        router.push('/customers');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id, router, showToast]);

  // ดึง address ล่าสุดจากการจอง (appointments)
  const fetchLatestAddressFromAppointments = async () => {
    if (!id) return;
    setFetchingAddress(true);
    try {
      const { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } = await import('firebase/firestore');
      let q;
      console.log('ค้นหา appointments ด้วย userId:', formData.userId);
      q = query(
        collection(db, 'appointments'),
        where('userId', '==', formData.userId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      console.log('ผลลัพธ์ appointments:', querySnapshot.docs.map(d => d.data()));
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        const address = docData.customerInfo?.address || '';
        if (address) {
          setLatestBookingAddress(address);
          // อัพเดต address ใน customers ทันที
          const customerRef = doc(db, 'customers', id);
          await updateDoc(customerRef, { address, updatedAt: new Date() });
          setFormData(prev => ({ ...prev, address }));
          showToast('บันทึกที่อยู่ล่าสุดจากการจองลงข้อมูลลูกค้าเรียบร้อย!', 'success');
        } else {
          showToast('ไม่พบที่อยู่ในข้อมูลการจองล่าสุด', 'warning');
        }
      } else {
        showToast('ไม่พบข้อมูลการจองของลูกค้าคนนี้', 'warning');
      }
    } catch (error) {
      console.error('Fetch address error:', error);
      showToast('เกิดข้อผิดพลาดในการดึงที่อยู่', 'error');
    } finally {
      setFetchingAddress(false);
    }
  };

  // ฟังก์ชันคัดลอก User ID (LINE)
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('คัดลอก User ID แล้ว!', 'success');
    });
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, "customers", id);
      await updateDoc(docRef, {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        // ไม่อัพเดต points เพราะลบออกแล้ว
        address: formData.address,
        mapLink: formData.mapLink,
        village: formData.village,
        detail: formData.detail,
        contact: formData.contact,
        note: formData.note,
        credit: formData.credit, // บันทึกเป็น text
        updatedAt: new Date()
      });
      showToast("อัปเดตข้อมูลลูกค้าสำเร็จ!", 'success');
      router.push('/customers');
    } catch (error) {
      showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
  {/* ลบ max-w-2xl เพื่อให้ฟอร์มกว้างเต็ม container */}
  <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">แก้ไขข้อมูลลูกค้า</h1>
        </div>

        <div className="bg-white p-10 rounded-lg shadow-md max-w-6xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* คอลัมน์ 1: ข้อมูลหลัก */}
              <div>
                {formData.userId && (
                  <div className="mb-4 flex items-center">
                    <span className="block text-sm font-medium text-gray-700 mr-2">LINE User ID</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.userId)}
                      className="inline-flex items-center px-2 py-1 bg-green-50 hover:bg-green-100 rounded focus:outline-none"
                      title="คัดลอก LINE User ID"
                    >
                      {/* LINE Icon SVG */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">
                        <rect width="48" height="48" rx="12" fill="#00C300"/>
                        <path fill="#fff" d="M24 13c-6.627 0-12 4.477-12 10 0 4.418 3.676 8.167 8.824 9.527.385.09.91.277.98.635.07.358.06.91.03 1.27l-.15 1.79c-.04.358.18.49.39.358l2.54-1.54c.27-.17.77-.24 1.09-.17C26.09 36.98 25.04 37 24 37c6.627 0 12-4.477 12-10s-5.373-10-12-10z"/>
                      </svg>
                      <span className="ml-2 text-xs font-mono text-green-700">{formData.userId}</span>
                    </button>
                  </div>
                )}
                <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">ที่อยู่จากการจองล่าสุด</label>
                <div className="flex gap-2 items-center mb-2">
                  <textarea
                    value={latestBookingAddress}
                    readOnly
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={fetchLatestAddressFromAppointments}
                    disabled={fetchingAddress}
                    className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center"
                    title="รีเฟรชที่อยู่จากการจอง"
                  >
                    {fetchingAddress ? (
                      <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" fill="none"/><path d="M12 2v4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/><path d="M12 18v4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M4 4v5h.582M20 20v-5h-.581" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 9.5A8.38 8.38 0 0 0 12 5.5a8.38 8.38 0 0 0-8 4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 14.5A8.38 8.38 0 0 0 12 18.5a8.38 8.38 0 0 0 8-4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </button>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ที่อยู่ (แก้ไขโดยแอดมิน)</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {/* คอลัมน์ 2: ข้อมูลที่อยู่และรายละเอียด */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ลิงก์แผนที่</label>
                <input
                  type="text"
                  name="mapLink"
                  value={formData.mapLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">หมู่บ้าน</label>
                <input
                  type="text"
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">รายละเอียด</label>
                <input
                  type="text"
                  name="detail"
                  value={formData.detail}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {/* คอลัมน์ 3: ข้อมูลเครดิตและอื่น ๆ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">เครดิต</label>
                <input
                  type="text"
                  name="credit"
                  value={formData.credit}
                  onChange={handleChange}
                  placeholder="เช่น 1000 บาท, ไม่มีเครดิต"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">ผู้ติดต่อ</label>
                <input
                  type="text"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">หมายเหตุ</label>
                <input
                  type="text"
                  name="note"
                  value={formData.note}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-4 pt-8">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/customers')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}