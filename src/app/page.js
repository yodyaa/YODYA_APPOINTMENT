// src/app/page.js
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// 1. Import Firebase functions ที่จำเป็น
import { auth } from '@/app/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
// 2. Import server action สำหรับตรวจสอบ admin
import { verifyAdminStatus } from '@/app/actions/adminActions';
// 3. Import LIFF context
import { useLiffContext } from '@/context/LiffProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  
  // เพิ่ม LIFF context (optional - ถ้าไม่มี context ให้ใช้ fallback)
  const liffData = useLiffContext() || {};

  const handleLineLogin = async () => {
    try {
      setLoading(true);
      setError('');

      if (typeof window !== 'undefined') {
        // ตรวจสอบว่าอยู่ใน LINE Browser หรือ Mobile App หรือไม่
        const userAgent = window.navigator.userAgent;
        const isInLineApp = userAgent.includes('Line/');
        
        console.log('[LINE LOGIN] User Agent:', userAgent);
        console.log('[LINE LOGIN] Is in LINE app:', isInLineApp);

        if (isInLineApp || process.env.NODE_ENV === 'development') {
          try {
            // ตรวจสอบว่ามี LIFF object หรือไม่
            if (liffData?.liffObject) {
              // ใช้ LIFF object ที่มีอยู่แล้ว
              const profile = await liffData.liffObject.getProfile();
              await checkAdminPermission(profile?.userId);
            } else if (window.liff && window.liff.isLoggedIn()) {
              // ใช้ window.liff โดยตรง
              const profile = await window.liff.getProfile();
              await checkAdminPermission(profile?.userId);
            } else {
              // ไม่มี LIFF หรือยังไม่ login
              console.log('[LINE LOGIN] No LIFF profile available');
              setError('ไม่สามารถเข้าถึง LINE Profile ได้ กรุณาลองใหม่อีกครั้ง');
            }
          } catch (liffError) {
            console.error('[LINE LOGIN] LIFF Error:', liffError);
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อกับ LINE');
          }
        } else {
          // ไม่อยู่ใน LINE App - แสดงข้อความแนะนำ
          setError('กรุณาเปิดลิงก์นี้ใน LINE Application เพื่อใช้งานระบบ');
        }
      }
    } catch (error) {
      console.error('[LINE LOGIN] Error:', error);
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ LINE');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันตรวจสอบสิทธิ์แอดมิน
  const checkAdminPermission = async (lineUserId) => {
    if (!lineUserId) {
      console.log('[ADMIN CHECK] No LINE User ID found');
      setError('ไม่สามารถดึงข้อมูล LINE User ID ได้');
      return;
    }

    try {
      console.log('[ADMIN CHECK] Checking admin permission for LINE ID:', lineUserId);
      
      // เรียกใช้ server action เพื่อตรวจสอบว่า LINE User ID นี้เป็นแอดมินหรือไม่
      const { verifyAdminByLineId } = await import('@/app/actions/adminActions');
      const result = await verifyAdminByLineId(lineUserId);
      
      console.log('[ADMIN CHECK] Result:', result);

      if (result.success && result.isAdmin) {
        // เป็นแอดมิน - ไปหน้า monthly-dashboard
        console.log('[ADMIN CHECK] User is admin - redirecting to dashboard');
        console.log('[ADMIN CHECK] Admin info:', result.adminData);
        router.push('/monthly-dashboard');
      } else if (result.success && !result.isAdmin) {
        // ไม่ใช่แอดมิน - แจ้งเตือนเท่านั้น
        console.log('[ADMIN CHECK] User is not admin - access denied');
        setError('คุณไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลเพื่อขอสิทธิ์');
      } else {
        // เกิดข้อผิดพลาดในการตรวจสอบ
        console.error('[ADMIN CHECK] Error in verification:', result.error);
        setError('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
      }
    } catch (error) {
      console.error('[ADMIN CHECK] Error checking admin permission:', error);
      setError('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 2. ลองทำการ Sign in ด้วยอีเมลและรหัสผ่าน
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. ใช้ server action เพื่อตรวจสอบว่า user เป็น admin หรือไม่
      const verificationResult = await verifyAdminStatus(user.uid);

      if (!verificationResult.success) {
        await signOut(auth);
        setError('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
        return;
      }

      if (verificationResult.isAdmin) {
        // 4. ถ้าเป็น admin จริง ให้ redirect ไปหน้า dashboard
        router.push('/monthly-dashboard');
      } else {
        // 5. ถ้าไม่ใช่ admin ให้ออกจากระบบและแสดงข้อผิดพลาด
        await signOut(auth);
        setError('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
      }

    } catch (error) {
      // 6. จัดการข้อผิดพลาดในการล็อกอิน
      console.error("Admin login failed:", error.code, error.message);
      let errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">

        {/* LINE Admin Login Section */}
        <div className="p-6 border rounded-lg bg-green-50">
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">เข้าสู่ระบบผู้ดูแลด้วย LINE</h2>
          <p className="text-sm text-gray-600 text-center mb-4">
            สำหรับผู้ดูแลระบบที่มีสิทธิ์เท่านั้น<br/>
            <span className="text-xs text-gray-500">กรุณาเปิดใน LINE Application</span>
          </p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}
          
          <button 
            onClick={handleLineLogin}
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:bg-green-400"
          >
            {loading ? 'กำลังตรวจสอบสิทธิ์...' : '🟢 เข้าสู่ระบบแอดมินด้วย LINE'}
          </button>
        </div>

        {/* Email Admin Section */}
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">เข้าสู่ระบบแอดมินด้วยอีเมล</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input 
                type="email" 
                name="email" 
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="password-admin" className="sr-only">Password</label>
              <input 
                type="password" 
                name="password-admin" 
                id="password-admin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
