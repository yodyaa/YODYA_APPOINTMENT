"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';

// --- Helper Components (แก้ไขใหม่) ---
const StatusBadge = ({ status }) => {
    let text = '';
    let colorClasses = '';
    switch (status) {
        case 'available':
            text = 'พร้อมทำงาน';
            colorClasses = 'bg-green-100 text-green-800';
            break;
        case 'on_trip':
            text = 'กำลังทำงาน';
            colorClasses = 'bg-blue-100 text-blue-800';
            break;
        case 'unavailable':
            text = 'ลา';
            colorClasses = 'bg-yellow-100 text-yellow-800';
            break;
        case 'suspended':
            text = 'พักงาน';
            colorClasses = 'bg-red-100 text-red-800';
            break;
        default:
            text = status || 'ไม่ระบุ';
            colorClasses = 'bg-gray-100 text-gray-700';
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses}`}>{text}</span>;
};

// --- เพิ่ม: ตัวกรองสถานะ ---
const statusFilters = [
    { key: 'available', label: 'พร้อมทำงาน' },
    { key: 'on_trip', label: 'กำลังทำงาน' },
    { key: 'unavailable', label: 'ลา' },
    { key: 'suspended', label: 'พักงาน' },
    { key: 'all', label: 'ทั้งหมด' }
];

export default function BeauticiansListPage() {
  const [allBeauticians, setAllBeauticians] = useState([]);
  const [filteredBeauticians, setFilteredBeauticians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('available');
  const [beauticianToDelete, setBeauticianToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();


  useEffect(() => {
    const fetchBeauticians = async () => {
        setLoading(true);
        try {
          const beauticiansQuery = query(collection(db, 'beauticians'), orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(beauticiansQuery);
          const beauticiansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllBeauticians(beauticiansData);
        } catch (err) {
          console.error("Error fetching beauticians: ", err);
          showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
        } finally {
          setLoading(false);
        }
    };
    fetchBeauticians();
  }, []);

  useEffect(() => {
      let filtered = allBeauticians;
      if (statusFilter !== 'all') {
          filtered = filtered.filter(b => b.status === statusFilter);
      }
      setFilteredBeauticians(filtered);
  }, [statusFilter, allBeauticians]);

  const handleDelete = (beautician) => {
    setBeauticianToDelete(beautician);
  };

  const confirmDelete = async () => {
    if (!beauticianToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "beauticians", beauticianToDelete.id));
      setAllBeauticians(prev => prev.filter(b => b.id !== beauticianToDelete.id));
      showToast("ลบข้อมูลช่างเสริมสวยสำเร็จ!", "success");
    } catch (error) {
      console.error("Error removing document: ", error);
      showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error");
    } finally {
      setIsDeleting(false);
      setBeauticianToDelete(null);
    }
  };

  if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูลพนักงาน...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
        <ConfirmationModal
            show={!!beauticianToDelete}
            title="ยืนยันการลบ"
            message={`คุณแน่ใจหรือไม่ว่าต้องการลบพนักงาน "${beauticianToDelete?.firstName} ${beauticianToDelete?.lastName}"?`}
            onConfirm={confirmDelete}
            onCancel={() => setBeauticianToDelete(null)}
            isProcessing={isDeleting}
        />
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
            <h1 className="text-2xl font-bold text-slate-800">จัดการพนักงาน</h1>
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    {statusFilters.map(filter => (
                        <button
                            key={filter.key}
                            onClick={() => setStatusFilter(filter.key)}
                            className={`px-3 py-1 text-sm rounded-md font-semibold whitespace-nowrap ${statusFilter === filter.key ? 'bg-white text-slate-800 shadow' : 'bg-transparent text-gray-600'}`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
                <Link href="/beauticians/add" className="bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-slate-700">
                  เพิ่มพนักงาน
                </Link>
            </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">พนักงาน</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                        <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBeauticians.map(beautician => (
                        <tr key={beautician.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <Image
                                            className="h-10 w-10 rounded-full object-cover"
                                            src={beautician.imageUrl || 'https://via.placeholder.com/150'}
                                            alt={`${beautician.firstName} ${beautician.lastName}`}
                                            width={40}
                                            height={40}
                                        />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">{beautician.firstName} {beautician.lastName}</div>
                                        <div className="text-sm text-gray-500">{beautician.lineUserId || 'N/A'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{beautician.phoneNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={beautician.status} /></td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <Link href={`/beauticians/edit/${beautician.id}`} className="text-indigo-600 hover:text-indigo-900">แก้ไข</Link>
                                <button onClick={() => handleDelete(beautician)} className="text-red-600 hover:text-red-900">ลบ</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
}