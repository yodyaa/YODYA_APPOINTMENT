// src/app/(admin)/gardeners/edit/[id]/page.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, storage } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/app/components/Toast';

export default function EditGardenerPage() {
  // [!code focus start]
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    lineUserId: '',
    imageUrl: '',
    status: 'available',
    position: ''
  });
  // [!code focus end]
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    const fetchGardener = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "gardeners", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            phoneNumber: data.phoneNumber || '',
            lineUserId: data.lineUserId || '',
            imageUrl: data.imageUrl || '',
            status: data.status || 'available',
            position: data.position || ''
          });
          setExistingImageUrl(data.profileImageUrl || data.imageUrl || '');
        } else {
          showToast("ไม่พบข้อมูลช่าง", "error");
          router.push('/gardeners');
        }
      } catch (error) {
        console.error("Error fetching document:", error);
        showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchGardener();
  }, [id, router, showToast]);
  // ฟังก์ชันเลือกรูปภาพและ preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB', 'error');
        return;
      }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ฟังก์ชันอัพโหลดรูปภาพไป Firebase Storage
  const uploadProfileImage = async (gardenerId) => {
    if (!profileImage) return null;
    try {
      setUploadingImage(true);
      const imageRef = ref(storage, `gardener-profiles/${gardenerId}/${Date.now()}_${profileImage.name}`);
      const snapshot = await uploadBytes(imageRef, profileImage);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = doc(db, "gardeners", id);
      let updateData = {
        ...formData,
        fullName: `${formData.firstName} ${formData.lastName}`.trim()
      };
      if (profileImage) {
        try {
          const newImageUrl = await uploadProfileImage(id);
          updateData.profileImageUrl = newImageUrl;
          updateData.imageUrl = newImageUrl;
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          showToast('อัพโหลดรูปภาพไม่สำเร็จ แต่จะอัพเดทข้อมูลอื่นต่อ', 'warning');
        }
      }
      await updateDoc(docRef, updateData);
      showToast("อัปเดตข้อมูลช่างสำเร็จ!", "success");
      router.push('/gardeners');
    } catch (error) {
      console.error("Error updating document: ", error);
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
      setLoading(false);
    }
  };

  if (loading) { // [!code focus]
    return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6">แก้ไขข้อมูลช่าง</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                        <input type="text" name="firstName" placeholder="สมชาย" value={formData.firstName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                        <input type="text" name="lastName" placeholder="ใจดี" value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                        <input type="tel" name="phoneNumber" placeholder="0812345678" value={formData.phoneNumber} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">สถานะ</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                            <option value="available">พร้อมให้บริการ</option>
                            <option value="on_trip">กำลังให้บริการ</option>
                            <option value="unavailable">ไม่พร้อม</option>
                            <option value="suspended">พักงาน</option>
                        </select>
                    </div>
                </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">ตำแหน่ง</label>
          <input type="text" name="position" placeholder="เช่น ช่างหลัก, ผู้ช่วย" value={formData.position} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">LINE User ID (ถ้ามี)</label>
          <input type="text" name="lineUserId" placeholder="U12345..." value={formData.lineUserId} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
        </div>
        {/* Profile Image Upload Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700">รูปโปรไฟล์</label>
          {/* Current Image Display */}
          {existingImageUrl && !profileImagePreview && (
            <div className="mt-2 mb-3">
              <p className="text-sm text-gray-600 mb-2">รูปปัจจุบัน:</p>
              <div className="relative w-24 h-24 border border-gray-300 rounded-lg overflow-hidden">
                <Image
                  src={existingImageUrl}
                  alt="Current Profile"
                  fill
                  className="object-cover"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/150?text=' + encodeURIComponent((formData.firstName?.charAt(0) || '') + (formData.lastName?.charAt(0) || ''));
                  }}
                />
              </div>
            </div>
          )}
          <div className="mt-1 space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500">
              อัพโหลดรูปภาพใหม่ (JPG, PNG) ขนาดไม่เกิน 5MB หรือใส่ URL รูปภาพด้านล่าง
            </p>
          </div>
          {/* New Image Preview */}
          {profileImagePreview && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">ตัวอย่างรูปภาพใหม่:</p>
              <div className="relative w-24 h-24 border border-gray-300 rounded-lg overflow-hidden">
                <Image
                  src={profileImagePreview}
                  alt="New Profile Preview"
                  fill
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileImage(null);
                  setProfileImagePreview(null);
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-800"
              >
                ยกเลิกรูปใหม่
              </button>
            </div>
          )}
          {/* URL Input as alternative */}
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700">หรือใส่ URL รูปภาพ</label>
            <input 
              type="url" 
              name="imageUrl" 
              placeholder="https://example.com/photo.jpg" 
              value={formData.imageUrl} 
              onChange={handleChange} 
              className="w-full mt-1 p-2 border rounded-md"
            />
          </div>
        </div>
                <button type="submit" disabled={loading || uploadingImage} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                  {uploadingImage ? 'กำลังอัพโหลดรูปภาพ...' : loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
            </form>
        </div>
    </div>
  );
}