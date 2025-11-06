"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, storage } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import Image from 'next/image';

export default function AddServicePage() {
  const [formData, setFormData] = useState({
    serviceName: '',
    imageUrl: '',
    details: '',
    category: '', // เพิ่มฟิลด์หมวดหมู่
    addOnServices: []
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serviceCategories, setServiceCategories] = useState([]); // เพิ่ม state สำหรับหมวดหมู่
  const router = useRouter();
  const { showToast } = useToast();
  const { profile } = useProfile();

  // โหลดหมวดหมู่บริการจาก settings
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // ตรวจสอบขนาดไฟล์ (จำกัดที่ 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB", "error");
        return;
      }
      // ตรวจสอบประเภทไฟล์
      if (!file.type.startsWith('image/')) {
        showToast("กรุณาเลือกไฟล์รูปภาพเท่านั้น", "error");
        return;
      }
      setImageFile(file);
      // สร้าง preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    
    setUploading(true);
    try {
      // สร้างชื่อไฟล์ที่ unique
      const timestamp = Date.now();
      const fileName = `services/${timestamp}_${imageFile.name}`;
      const storageRef = ref(storage, fileName);
      
      // อัปโหลดไฟล์
      await uploadBytes(storageRef, imageFile);
      
      // ดึง URL ของรูปภาพ
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image: ", error);
      showToast("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ", "error");
      return null;
    } finally {
      setUploading(false);
    }
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
      showToast("กรุณากรอกชื่อบริการ", "error");
      return;
    }
    setLoading(true);
    try {
      // อัปโหลดรูปภาพก่อน (ถ้ามี)
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      await addDoc(collection(db, "services"), {
        ...formData,
        imageUrl,
        status: 'available', // ตั้งค่าเริ่มต้นให้เปิดให้บริการ
        addOnServices: (formData.addOnServices || []).map(a => ({ ...a })),
        createdAt: serverTimestamp(),
      });
      showToast("เพิ่มบริการใหม่สำเร็จ!", "success");
      // หน่วงเวลาเล็กน้อยเพื่อให้ Firebase sync ข้อมูล
      setTimeout(() => {
        router.push('/services');
      }, 500);
    } catch (error) {
      console.error("Error adding document: ", error);
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">เพิ่มบริการใหม่</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">ชื่อบริการ</label>
          <input name="serviceName" value={formData.serviceName} onChange={handleChange} placeholder="เช่น ตัดผมชาย" required className="w-full mt-1 p-2 border rounded-md" />
        </div>

        {/* ฟิลด์หมวดหมู่ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่บริการ</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full mt-1 p-2 border rounded-md bg-white"
          >
            <option value="">-- เลือกหมวดหมู่ (ไม่บังคับ) --</option>
            {serviceCategories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {serviceCategories.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">
              ยังไม่มีหมวดหมู่ สามารถเพิ่มได้ที่ <a href="/settings" className="text-blue-600 underline">หน้าตั้งค่า</a>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">รูปภาพบริการ</label>
          <div className="space-y-3">
            {/* แสดง preview รูปภาพ */}
            {imagePreview && (
              <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                <Image src={imagePreview} alt="Preview" fill style={{ objectFit: 'cover' }} />
              </div>
            )}
            {/* ปุ่มเลือกไฟล์ */}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="text-xs text-gray-500">หรือใส่ URL รูปภาพโดยตรง (ถ้าไม่อัปโหลดไฟล์)</p>
            <input
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.png"
              className="w-full p-2 border rounded-md text-sm"
            />
          </div>
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
        <button type="submit" disabled={loading || uploading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
          {uploading ? 'กำลังอัปโหลดรูปภาพ...' : loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบริการ'}
        </button>
      </form>
    </div>
  );
}