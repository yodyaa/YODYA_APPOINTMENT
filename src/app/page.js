// src/app/page.js
"use client";

import { useState, useEffect } from 'react';
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
  const [isLiffReady, setIsLiffReady] = useState(false);
  const router = useRouter();
  
  // เพิ่ม LIFF context (optional - ถ้าไม่มี context ให้ใช้ fallback)
  const liffData = useLiffContext() || {};
  const { profile, loading: liffLoading, error: liffError, liffObject } = liffData;

  // ตรวจสอบว่า LIFF พร้อมใช้งานหรือยัง
  useEffect(() => {
    if (!liffLoading && !liffError && (liffObject || window.liff)) {
      setIsLiffReady(true);
      console.log('[LOGIN] LIFF is ready');
    } else if (liffError) {
      setIsLiffReady(false);
      console.error('[LOGIN] LIFF error:', liffError);
    }
  }, [liffLoading, liffError, liffObject]);

  const handleLineLogin = async () => {
    try {
      setLoading(true);
      setError('');

      // รอให้ LIFF โหลดเสร็จก่อน
      if (liffLoading) {
        setError('กำลังโหลด LINE SDK... กรุณารอสักครู่');
        setLoading(false);
        return;
      }

      if (liffError) {
        setError('เกิดข้อผิดพลาดในการโหลด LINE SDK: ' + liffError);
        setLoading(false);
        return;
      }

      if (!isLiffReady) {
        setError('LINE SDK ยังไม่พร้อม กรุณารอสักครู่...');
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        try {
          const liff = liffObject || window.liff;
          
          if (!liff) {
            setError('ไม่พบ LINE SDK กรุณาลองใหม่อีกครั้ง');
            return;
          }

          console.log('[LINE LOGIN] LIFF is ready, checking login status...');
          
          // ตรวจสอบว่า login แล้วหรือยัง
          if (!liff.isLoggedIn()) {
            console.log('[LINE LOGIN] Not logged in, redirecting to LINE login...');
            // ถ้ายังไม่ได้ login ให้เปิด LINE login (ทำงานได้ทั้งใน LINE App และ Browser)
            liff.login({ redirectUri: window.location.href });
            return;
          }

          console.log('[LINE LOGIN] Already logged in, getting profile...');
          
          // ถ้า login แล้ว ดึง profile (ใช้จาก context ถ้ามี)
          const userProfile = profile || await liff.getProfile();

          console.log('[LINE LOGIN] Got profile:', userProfile?.userId);
          
          if (userProfile?.userId) {
            await checkAdminPermission(userProfile.userId);
          } else {
            setError('ไม่สามารถดึงข้อมูล LINE Profile ได้');
          }
          
        } catch (liffError) {
          console.error('[LINE LOGIN] LIFF Error:', liffError);
          setError('เกิดข้อผิดพลาดในการเชื่อมต่อกับ LINE: ' + liffError.message);
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
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = "ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง";
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
            <span className="text-xs text-gray-500">ใช้งานได้ทั้งใน LINE App และ Browser</span>
          </p>
          
          {/* แสดงสถานะการโหลด LIFF */}
          {liffLoading && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-blue-600 text-sm">กำลังโหลด LINE SDK...</p>
              </div>
            </div>
          )}
          
          {!liffLoading && isLiffReady && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-600 text-sm text-center">✓ LINE SDK พร้อมใช้งาน</p>
            </div>
          )}
          
          {liffError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm text-center">❌ {liffError}</p>
            </div>
          )}
          
          {error && !liffLoading && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}
          
          <button 
            onClick={handleLineLogin}
            disabled={loading || liffLoading || !isLiffReady}
            className="w-full flex items-center justify-center py-3 px-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {liffLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังโหลด LINE SDK...
              </>
            ) : loading ? (
              'กำลังตรวจสอบสิทธิ์...'
            ) : !isLiffReady ? (
              '⏳ รอ LINE SDK...'
            ) : (
              '🟢 เข้าสู่ระบบแอดมินด้วย LINE'
            )}
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
