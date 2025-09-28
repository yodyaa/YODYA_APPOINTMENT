"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

export default function EditServicePage() {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();
  const { profile } = useProfile();

  useEffect(() => {
    if (!id) return;
    const fetchService = async () => {
      setLoading(true);
      const docRef = doc(db, "services", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          ...data,
          status: data.status || 'available',
          addOnServices: (data.addOnServices || []).map(a => ({ ...a }))
        });
      } else {
        showToast("ไม่พบข้อมูลบริการนี้", "error");
        router.push('/services');
      }
      setLoading(false);
    };
    fetchService();
  }, [id, router, showToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddOnChange = (idx, field, value) => {
    setFormData(prev => {
      const addOnServices = [...(prev.addOnServices || [])];
      addOnServices[idx][field] = value;
      return { ...prev, addOnServices };
    });
  };

  const handleAddAddOn = () => {
    setFormData(prev => ({
      ...prev,
      addOnServices: [...(prev.addOnServices || []), { name: '' }]
    }));
  };

  const handleRemoveAddOn = (idx) => {
    setFormData(prev => {
      const addOnServices = [...(prev.addOnServices || [])];
      addOnServices.splice(idx, 1);
      return { ...prev, addOnServices };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.serviceName) {
      showToast('กรุณากรอกชื่อบริการ', 'error');
      return;
    }
    setLoading(true);
    try {
      const docRef = doc(db, 'services', id);
      await updateDoc(docRef, {
        ...formData,
        status: formData.status || 'available',
        addOnServices: (formData.addOnServices || []).map(a => ({ ...a })),
      });
      showToast('แก้ไขบริการสำเร็จ!', 'success');
      router.push('/services');
    } catch (error) {
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !formData) return <div className="text-center mt-20">กำลังโหลด...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">แก้ไขบริการ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">ชื่อบริการ</label>
          <input name="serviceName" value={formData.serviceName} onChange={handleChange} placeholder="เช่น ตัดผมชาย" required className="w-full mt-1 p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">สถานะบริการ</label>
          <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md">
            <option value="available">ให้บริการ</option>
            <option value="unavailable">งดให้บริการ</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">URL รูปภาพ</label>
          <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://example.com/image.png" className="w-full mt-1 p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">รายละเอียดเพิ่มเติม</label>
          <textarea name="details" value={formData.details} onChange={handleChange} rows="3" placeholder="รายละเอียดบริการ เช่น ใช้ผลิตภัณฑ์อะไร ฯลฯ" className="w-full mt-1 p-2 border rounded-md"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">บริการเสริม</label>
          {(formData.addOnServices || []).map((addOn, idx) => (
            <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="ชื่อบริการเสริม"
                value={addOn.name}
                onChange={e => handleAddOnChange(idx, 'name', e.target.value)}
                className="flex-1 p-2 border rounded-md"
              />
              <button type="button" onClick={() => handleRemoveAddOn(idx)} className="text-red-500 px-2">ลบ</button>
            </div>
          ))}
          <button type="button" onClick={handleAddAddOn} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md mt-2">+ เพิ่มบริการเสริม</button>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
          {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
        </button>
      </form>
    </div>
  );
}