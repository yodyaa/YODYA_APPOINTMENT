"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

// --- Helper Components ---
const StatusButton = ({ status }) => {
    let text, colorClasses;
    switch (status) {
        case 'available':
            text = 'ให้บริการ';
            colorClasses = 'bg-green-500 hover:bg-green-600';
            break;
        case 'unavailable':
            text = 'งดให้บริการ';
            colorClasses = 'bg-red-500 hover:bg-red-600';
            break;
        default:
            text = 'ไม่ระบุ';
            colorClasses = 'bg-gray-400';
    }
    return <button className={`text-xs text-white font-semibold py-1 px-3 rounded-md ${colorClasses}`}>{text}</button>;
};

// --- Helpers ---
const safeDate = (d) => {
  if (!d) return null;
  if (d?.toDate && typeof d.toDate === 'function') return d.toDate();
  if (typeof d === 'string' || typeof d === 'number') return new Date(d);
  if (d instanceof Date) return d;
  return null;
};

const formatPrice = (v) => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return v.toLocaleString();
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
};

export default function ServicesListPage() {
  const [allServices, setAllServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [favoriteUpdatingId, setFavoriteUpdatingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();
  const { profile, loading: profileLoading } = useProfile();

  // --- NEW: State สำหรับหมวดหมู่และการกรอง ---
  const [serviceCategories, setServiceCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- NEW: โหลดหมวดหมู่บริการจาก settings ---
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesDoc = await getDoc(doc(db, 'settings', 'serviceCategories'));
        if (categoriesDoc.exists()) {
          const data = categoriesDoc.data();
          setServiceCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // อัพเดทสถานะรายการโปรด
  const handleToggleFavorite = async (service) => {
    if (!service?.id) return;
    const newFavorite = !service.isFavorite;
    setFavoriteUpdatingId(service.id);
    try {
      await updateDoc(doc(db, 'services', service.id), { 
        isFavorite: newFavorite,
        updatedAt: new Date()
      });
      setAllServices(prev => prev.map(s => s.id === service.id ? { ...s, isFavorite: newFavorite } : s));
      setFilteredServices(prev => prev.map(s => s.id === service.id ? { ...s, isFavorite: newFavorite } : s));
      showToast(`${newFavorite ? 'เพิ่มเป็น' : 'ลบออกจาก'}รายการโปรดสำเร็จ!`, 'success');
    } catch (err) {
      console.error('Error updating favorite:', err);
      showToast('เกิดข้อผิดพลาดในการอัพเดทรายการโปรด', 'error');
    } finally {
      setFavoriteUpdatingId(null);
    }
  };

  // อัพเดทสถานะบริการ
  const handleUpdateStatus = async (service) => {
      if (!service?.id) return;
      const newStatus = service.status === 'available' ? 'unavailable' : 'available';
      setStatusUpdatingId(service.id);
      try {
        await updateDoc(doc(db, 'services', service.id), { status: newStatus });
        setAllServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
        setFilteredServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
        showToast(`อัพเดทสถานะบริการเป็น "${newStatus === 'available' ? 'ให้บริการ' : 'งดให้บริการ'}" สำเร็จ!`, 'success');
      } catch (err) {
        console.error('Error updating status:', err);
        showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error');
      } finally {
        setStatusUpdatingId(null);
      }
    };
  const handleDeleteService = (service) => {
    setServiceToDelete(service);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'services', serviceToDelete.id));
      setAllServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      setFilteredServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      showToast('ลบข้อมูลบริการสำเร็จ!', 'success');
    } catch (error) {
      console.error('Error removing document: ', error);
      showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    } finally {
        setIsDeleting(false);
        setServiceToDelete(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    const servicesQuery = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
    
    // ใช้ onSnapshot เพื่อ realtime updates
    const unsubscribe = onSnapshot(
      servicesQuery,
      (querySnapshot) => {
        console.log('Services list updated:', querySnapshot.docs.length);
        const servicesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // เรียงลำดับ: รายการโปรดก่อน (isFavorite: true) แล้วตามด้วยวันที่สร้างใหม่สุด
        const sortedServices = servicesData.sort((a, b) => {
          // ถ้า a เป็นรายการโปรด แต่ b ไม่ใช่ ให้ a อยู่ข้างหน้า
          if (a.isFavorite && !b.isFavorite) return -1;
          // ถ้า b เป็นรายการโปรด แต่ a ไม่ใช่ ให้ b อยู่ข้างหน้า
          if (!a.isFavorite && b.isFavorite) return 1;
          // ถ้าทั้งคู่เป็นหรือไม่เป็นรายการโปรดเหมือนกัน ให้เรียงตามวันที่สร้าง (ใหม่ก่อน)
          const dateA = safeDate(a.createdAt)?.getTime() || 0;
          const dateB = safeDate(b.createdAt)?.getTime() || 0;
          return dateB - dateA;
        });
        
        setAllServices(sortedServices);
        setFilteredServices(sortedServices);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching services: ", error);
        showToast("ไม่สามารถโหลดข้อมูลบริการได้", "error");
        setLoading(false);
      }
    );

    // Cleanup listener เมื่อ component unmount
    return () => unsubscribe();
  }, []);

  // --- NEW: ฟังก์ชันกรองบริการ ---
  useEffect(() => {
    let filtered = [...allServices];

    // กรองตามหมวดหมู่
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    // กรองตามคำค้นหา
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(service => 
        (service.serviceName || service.name || '').toLowerCase().includes(query) ||
        (service.description || '').toLowerCase().includes(query)
      );
    }

    setFilteredServices(filtered);
  }, [allServices, selectedCategory, searchQuery]);

  if (loading || profileLoading) return <div className="text-center mt-20">กำลังโหลดข้อมูลบริการ...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
        <ConfirmationModal
            show={!!serviceToDelete}
            title="ยืนยันการลบ"
            message={`คุณแน่ใจหรือไม่ว่าต้องการลบบริการ "${serviceToDelete?.serviceName || serviceToDelete?.name}"?`}
            onConfirm={confirmDeleteService}
            onCancel={() => setServiceToDelete(null)}
            isProcessing={isDeleting}
        />
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-800">จัดการข้อมูลบริการ</h1>
        <Link href="/services/add" className="bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-slate-700">
          เพิ่มบริการ
        </Link>
      </div>

      {/* ฟิลเตอร์และการค้นหา */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row gap-4">
          {/* ค้นหา */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 ค้นหาบริการ (ชื่อ, รายละเอียด...)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* กรองตามหมวดหมู่ */}
          <div className="md:w-64">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="all">📂 ทุกหมวดหมู่</option>
              {serviceCategories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value="uncategorized">ไม่มีหมวดหมู่</option>
            </select>
          </div>
        </div>

        {/* แสดงจำนวนผลลัพธ์ */}
        <div className="mt-3 text-sm text-gray-600">
          แสดง {filteredServices.length} จาก {allServices.length} บริการ
          {selectedCategory !== 'all' && ` | หมวดหมู่: ${serviceCategories.find(c => c.id === selectedCategory)?.name || 'ไม่มีหมวดหมู่'}`}
          {searchQuery && ` | ค้นหา: "${searchQuery}"`}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map(service => (
              <div key={service.id} className={`bg-white rounded-lg shadow-md p-4 flex flex-col justify-between relative ${service.isFavorite ? 'ring-2 ring-yellow-400' : ''}`}>
                  {/* ไอคอนดาวรายการโปรด */}
                  {service.isFavorite && (
                    <div className="absolute top-2 right-2 bg-yellow-400 text-white rounded-full p-1.5 shadow-lg z-10">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  )}
                  <div>
                      <div className="relative w-full h-40 mb-3">
                                  <Image src={service.imageUrl || '/placeholder.png'} alt={service.serviceName || service.name || 'service'} fill style={{ objectFit: 'cover' }} className="rounded-md" />
                      </div>
                      <div>
                          <p className="font-bold text-lg text-gray-800">{service.serviceName || service.name}</p>
                          {/* แสดงแท็กหมวดหมู่ */}
                          {service.category && (
                            <div className="mt-1">
                              <span className="inline-block bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-medium">
                                {serviceCategories.find(c => c.id === service.category)?.name || service.category}
                              </span>
                            </div>
                          )}
                      </div>
                      <div className="text-sm text-gray-600 mt-2 border-t pt-2 space-y-1">
                          <p className="truncate"><strong>รายละเอียด:</strong> {service.description || service.details || service.desc || 'ไม่มีรายละเอียด'}</p>
                          {service.addOnServices && service.addOnServices.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium">บริการเสริม:</p>
                              <ul className="text-sm mt-1 space-y-1">
                                {service.addOnServices.map((a, i) => (
                                  <li key={i}>
                                    <span>{a.name || a.title || a.label || 'ไม่มีชื่อ'}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {service.createdAt && (
                            <p className="text-xs text-gray-400 mt-2">สร้างเมื่อ: {format(safeDate(service.createdAt), 'dd MMM yyyy', { locale: th })}</p>
                          )}
                          {service.updatedAt && (
                            <p className="text-xs text-gray-400">อัพเดต: {format(safeDate(service.updatedAt), 'dd MMM yyyy', { locale: th })}</p>
                          )}
                      </div>
                  </div>
                  <div className="border-t mt-4 pt-3 space-y-2">
                      {/* ปุ่มรายการโปรด */}
                      <button
                        className={`w-full text-sm px-3 py-2 rounded-md font-semibold border transition-colors ${
                          service.isFavorite 
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100' 
                            : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                        } ${favoriteUpdatingId === service.id ? 'opacity-60 pointer-events-none' : ''}`}
                        onClick={() => handleToggleFavorite(service)}
                        disabled={favoriteUpdatingId === service.id}
                      >
                        {service.isFavorite ? '⭐ ลบออกจากรายการโปรด' : '☆ เพิ่มเป็นรายการโปรด'}
                      </button>
                      
                      {/* สถานะบริการ */}
                      <div className="flex gap-2 items-center">
                        <StatusButton status={service.status} />
                        <button
                          className={`text-xs px-2 py-1 rounded-md font-semibold border ${service.status === 'available' ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' : 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'} ${statusUpdatingId === service.id ? 'opacity-60 pointer-events-none' : ''}`}
                          onClick={() => handleUpdateStatus(service)}
                          disabled={statusUpdatingId === service.id}
                        >
                          {service.status === 'available' ? 'งดให้บริการ' : 'เปิดให้บริการ'}
                        </button>
                      </div>
                      
                      {/* ปุ่มแก้ไขและลบ */}
                      <div className="flex gap-2">
                          <Link href={`/services/edit/${service.id}`} className="flex-1 text-center text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-3 rounded-md">แก้ไข</Link>
                          <button onClick={() => handleDeleteService(service)} className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md">ลบ</button>
                      </div>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
}
