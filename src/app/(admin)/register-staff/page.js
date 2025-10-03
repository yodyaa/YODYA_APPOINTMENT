"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/app/lib/firebase';  
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

export default function RegisterStaffPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    lineUserId: '',
    role: 'employee', // [!code focus]
    status: 'available'
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // ตรวจสอบ file type
      if (!file.type.startsWith('image/')) {
        setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }
      // ตรวจสอบ file size (ไม่เกิน 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB');
        return;
      }
      
      setProfileImage(file);
      
      // สร้าง preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError(''); // Clear error if valid
    }
  };

  const uploadProfileImage = async (userId) => {
    if (!profileImage) return null;
    
    try {
      setUploadingImage(true);
      const imageRef = ref(storage, `staff-profiles/${userId}/${profileImage.name}`);
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
    setError('');
    if (!formData.firstName || !formData.phone || !formData.email || !formData.password) {
        setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        return;
    }
    if (formData.password.length < 6) {
        setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
        return;
    }
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.lastName}`.trim(),
      });

      // [!code focus start]
      // อัพโหลดรูปภาพก่อน (ถ้ามี)
      let profileImageUrl = null;
      if (profileImage) {
        try {
          profileImageUrl = await uploadProfileImage(user.uid);
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          // ถ้าอัพโหลดรูปไม่สำเร็จ ยังคงสร้าง account ได้ แต่ไม่มีรูป
          setError('อัพโหลดรูปภาพไม่สำเร็จ แต่การลงทะเบียนจะดำเนินการต่อ');
        }
      }
      
      // เปลี่ยนเป้าหมายการบันทึกตาม role ที่เลือก
      const targetCollection = formData.role === 'admin' ? 'admins' : 'employees';
      const dataToSave = {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        phoneNumber: formData.phone,
        email: user.email,
        lineUserId: formData.lineUserId,
        status: formData.status,
        profileImageUrl: profileImageUrl,
        createdAt: serverTimestamp(),
      };

      if (formData.role === 'admin') {
        dataToSave.role = 'admin'; // เพิ่ม role field สำหรับ admin
      }

      // ใช้ uid เป็น Document ID เพื่อให้เชื่อมกับ Authentication ได้ง่าย
      await setDoc(doc(db, targetCollection, user.uid), dataToSave);
      // [!code focus end]

      alert(`เพิ่มผู้ใช้ตำแหน่ง ${formData.role} สำเร็จ!`);
      // [!code focus start]
      // นำทางไปยังหน้าที่เกี่ยวข้องหลังจากสร้างผู้ใช้
      if (formData.role === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/employees');
      }
      // [!code focus end]

    } catch (error) {
      console.error("Error creating new user:", error.code, error.message);
      let errorMessage = "เกิดข้อผิดพลาดที่ไม่รู้จักในการลงทะเบียน";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "รหัสผ่านไม่ปลอดภัย (ต้องมีอย่างน้อย 6 ตัวอักษร)";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6">ลงทะเบียนผู้ใช้ใหม่ (แอดมิน / พนักงาน)</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                            <input name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                            <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ตำแหน่ง</label>
                            <select name="role" value={formData.role} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                                <option value="employee">พนักงาน</option>
                                <option value="admin">ผู้ดูแลระบบ</option>
                            </select>
                        </div>
                        {/* --- แสดง Dropdown สถานะสำหรับพนักงานเท่านั้น --- */}
                        {formData.role === 'employee' && ( // [!code focus]
                            <div>
                                <label className="block text-sm font-medium text-gray-700">สถานะ</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                                    <option value="available">พร้อมทำงาน</option>
                                    <option value="on_leave">ลาพัก</option>
                                    <option value="suspended">พักงาน</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">อีเมล (สำหรับเข้าระบบ)</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="อย่างน้อย 6 ตัวอักษร" className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">LINE User ID (ถ้ามี)</label>
                        <input name="lineUserId" value={formData.lineUserId} onChange={handleChange} placeholder="U12345..." className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    
                    {/* Profile Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">รูปโปรไฟล์ (ถ้ามี)</label>
                        <div className="mt-1">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                ไฟล์รูปภาพ (JPG, PNG) ขนาดไม่เกิน 5MB
                            </p>
                        </div>
                        
                        {/* Image Preview */}
                        {profileImagePreview && (
                            <div className="mt-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">ตัวอย่างรูปภาพ:</p>
                                <div className="relative w-32 h-32 border border-gray-300 rounded-lg overflow-hidden">
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
                    </div>
                    
                    {error && <p className="text-red-500 text-sm text-center font-semibold">{error}</p>}
                    
                    <button type="submit" disabled={loading || uploadingImage} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                      {uploadingImage ? 'กำลังอัพโหลดรูปภาพ...' : loading ? 'กำลังบันทึก...' : 'ลงทะเบียนผู้ใช้'}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
}