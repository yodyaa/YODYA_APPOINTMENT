"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, storage } from '@/app/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/app/components/Toast';

export default function AddGardenerPage() {
  const [formData, setFormData] = useState({ 
    firstName: '', 
    lastName: '', 
    phoneNumber: '', 
    lineUserId: '',
    imageUrl: '',
    status: 'available',
    position: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // ตรวจสอบ file type
      if (!file.type.startsWith('image/')) {
        showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
      }
      // ตรวจสอบ file size (ไม่เกิน 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB', 'error');
        return;
      }
      
      setProfileImage(file);
      
      // สร้าง preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfileImage = async (gardenerId) => {
    if (!profileImage) return formData.imageUrl; // ใช้ imageUrl เก่าถ้าไม่มีรูปใหม่
    
    try {
      setUploadingImage(true);
      const imageRef = ref(storage, `gardener-profiles/${gardenerId}/${profileImage.name}`);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!formData.firstName || !formData.phoneNumber) {
      showToast("กรุณากรอกชื่อ และเบอร์โทร", "error");
      setLoading(false);
      return;
    }
    try {
      // สร้าง document ก่อนเพื่อให้ได้ ID สำหรับอัพโหลดรูป
      const docRef = await addDoc(collection(db, "gardeners"), {
        ...formData,
        profileImageUrl: '', // จะอัพเดทภายหลัง
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        createdAt: serverTimestamp(),
      });
      
      // อัพโหลดรูปภาพ (ถ้ามี)
      let finalImageUrl = formData.imageUrl;
      if (profileImage) {
        try {
          finalImageUrl = await uploadProfileImage(docRef.id);
          // อัพเดทรูปภาพใน document
          await updateDoc(doc(db, "gardeners", docRef.id), {
            profileImageUrl: finalImageUrl,
            imageUrl: finalImageUrl // รองรับ field เก่าด้วย
          });
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          showToast('อัพโหลดรูปภาพไม่สำเร็จ แต่เพิ่มพนักงานสำเร็จแล้ว', 'warning');
        }
      }
      
      showToast("เพิ่มพนักงานใหม่สำเร็จ!", "success");
      router.push('/gardeners');
    } catch (error) {
      console.error("Error adding document: ", error);
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6">เพิ่มช่างใหม่</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                        <input type="text" name="firstName"  value={formData.firstName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                        <input type="text" name="lastName"  value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                        <input type="tel" name="phoneNumber"  value={formData.phoneNumber} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
            <label className="block text-sm font-medium text-gray-700">สถานะ</label>
            <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
              <option value="available">พร้อมให้บริการ</option>
              <option value="on_job">กำลังให้บริการ</option>
              <option value="unavailable">ไม่พร้อมให้บริการ</option>
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
          <div className="mt-1 space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500">
              อัพโหลดรูปภาพ (JPG, PNG) ขนาดไม่เกิน 5MB หรือใส่ URL รูปภาพด้านล่าง
            </p>
          </div>
          
          {/* Image Preview */}
          {profileImagePreview && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">ตัวอย่างรูปภาพ:</p>
              <div className="relative w-24 h-24 border border-gray-300 rounded-lg overflow-hidden">
                <Image
                  src={profileImagePreview}
                  alt="Profile Preview"
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
                ลบรูปภาพ
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

        <button type="submit" disabled={loading || uploadingImage} className="w-full bg-gray-900 text-white p-2 rounded-md hover:bg-gray-700 disabled:bg-gray-400">
          {uploadingImage ? 'กำลังอัพโหลดรูปภาพ...' : loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </button>
            </form>
        </div>
    </div>
  );
}