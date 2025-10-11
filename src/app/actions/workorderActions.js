"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { 
  sendServiceCompletedFlexMessage, 
  sendAppointmentCancelledFlexMessage,
  sendAppointmentConfirmedFlexMessage 
} from './lineFlexActions';

export async function updateWorkorderStatusByAdmin({ workorderId, field, value, adminName }) {
  try {
    // อ่านข้อมูล workorder เดิม (ใช้ Firebase Admin SDK)
    const workorderRef = db.collection("workorders").doc(workorderId);
    const workorderSnap = await workorderRef.get();
    if (!workorderSnap.exists) {
      throw new Error("ไม่พบข้อมูล workorder");
    }
    const oldData = workorderSnap.data();

    // อัปเดต field ที่ต้องการ
    await workorderRef.update({ [field]: value });

    // รองรับ key หลายแบบ: customerLineId, lineUserId, userIDline, customerInfo.lineUserId, customerInfo.lineId
    const customerLineId =
      oldData.customerLineId ||
      oldData.lineUserId ||
      oldData.userIDline ||
      (oldData.customerInfo && (oldData.customerInfo.lineUserId || oldData.customerInfo.lineId));
    const workorderData = { id: workorderId, ...oldData, [field]: value };

    // อ่าน settings จาก Firestore แทนการ hardcode
    const { getNotificationSettings } = await import('./settingsActions');
    const { success: settingsSuccess, settings } = await getNotificationSettings();
    const notifyProcessing = settingsSuccess && settings?.customerNotifications?.notifyProcessing;
    const notifyCompleted = settingsSuccess && settings?.customerNotifications?.notifyCompleted;

    if (field === 'processStatus' && customerLineId) {
      try {
        // ส่ง Flex Message เฉพาะเมื่อเสร็จสิ้น เท่านั้น
        if (value === 'เสร็จสิ้น' && notifyCompleted) {
          console.log('[WORKORDER][updateWorkorderStatusByAdmin] sendServiceCompletedFlexMessage', { customerLineId, workorderData });
          await sendServiceCompletedFlexMessage(customerLineId, workorderData);
        } else {
          console.log('[WORKORDER][updateWorkorderStatusByAdmin] ไม่ส่ง Flex Message', { 
            value, 
            notifyCompleted, 
            reason: (value === 'กำลังดำเนินการ' || value === 'ช่างกำลังดำเนินการ') ? 'ไม่ส่ง Flex สำหรับสถานะกำลังดำเนินการ' : 'สถานะไม่ตรงเงื่อนไข' 
          });
        }
      } catch (flexErr) {
        console.error('[WORKORDER][updateWorkorderStatusByAdmin] Flex error', flexErr);
        // ไม่ throw error flex เพื่อไม่ให้กระทบการอัปเดตสถานะหลัก
      }
    }
    return { success: true };
  } catch (err) {
    console.error('[WORKORDER][updateWorkorderStatusByAdmin] ERROR', err);
    return { success: false, error: err?.message || String(err) };
  }
}
// workorderActions.js
// ...existing code...

/**
 * ส่ง Flex Message สถานะ "ยืนยันแล้ว" ไปยัง LINE OA ของลูกค้า
 * หมายเหตุ: ฟังก์ชันนี้ถูกปิดใช้งานเพื่อป้องกันการส่ง Flex Message ที่ไม่เหมาะสม
 * @param {string} userId - LINE User ID ของลูกค้า
 * @param {object} workorderData - ข้อมูลงานที่สร้าง
 */
export async function sendWorkorderConfirmedFlex(userId, workorderData) {
  try {
    if (!userId || !userId.startsWith('U')) {
      console.warn('[sendWorkorderConfirmedFlex] ไม่พบ LINE User ID ที่ถูกต้อง ข้ามการส่ง');
      return { success: false, error: 'invalid-line-user-id' };
    }
    console.log('[sendWorkorderConfirmedFlex] ส่ง Flex ยืนยันงาน:', { userId, workorderData });
    // แปลง payload ให้มีโครงสร้างคล้าย appointment เพื่อใช้ template เดิม
    const payload = {
      id: workorderData.id || workorderData.idKey || '',
      serviceInfo: { name: workorderData.serviceName || workorderData.workorder || 'งานบริการ' },
      customerInfo: { fullName: workorderData.name || 'ลูกค้า' },
      date: workorderData.date,
      time: workorderData.time || '',
      appointmentInfo: {},
      gardenerName: workorderData.responsible || workorderData.gardenerName || '',
      caseNumber: workorderData.caseNumber || '',
      price: workorderData.price || workorderData.payment || ''
    };
    const result = await sendAppointmentConfirmedFlexMessage(userId, payload);
    console.log('[sendWorkorderConfirmedFlex] ส่งสำเร็จ');
    return result;
  } catch (error) {
    console.error('[sendWorkorderConfirmedFlex] ERROR:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ยกเลิก workorder และแจ้งลูกค้า (ถ้ามี LINE ID)
 */
export async function cancelWorkorderAndNotify({ workorderId, reason = 'ยกเลิกโดยแอดมิน' }) {
  try {
    const ref = db.collection('workorders').doc(workorderId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: 'not-found' };
    const data = snap.data();

    // อัปเดตสถานะในฐานข้อมูล
    await ref.update({ status: 'cancelled', processStatus: 'cancelled', cancelledAt: new Date(), cancelReason: reason });

    // เลือก LINE ID
    const lineId = data.customerLineId || data.lineUserId || data.userIDline || data.customerInfo?.lineUserId || '';
    if (lineId && lineId.startsWith('U')) {
      try {
        const payload = {
          id: workorderId,
          serviceInfo: { name: data.serviceName || data.workorder || 'งานบริการ' },
            customerInfo: { fullName: data.name || data.customerInfo?.fullName || 'ลูกค้า' },
          date: data.date || '',
          time: data.time || ''
        };
        console.log('[cancelWorkorderAndNotify] ส่ง Flex ยกเลิกให้ลูกค้า', { lineId, reason });
        await sendAppointmentCancelledFlexMessage(lineId, payload, reason);
      } catch (flexErr) {
        console.error('[cancelWorkorderAndNotify] Flex error', flexErr);
      }
    } else {
      console.log('[cancelWorkorderAndNotify] ไม่มี LINE ID สำหรับ workorder นี้');
    }

    return { success: true };
  } catch (err) {
    console.error('[cancelWorkorderAndNotify] ERROR', err);
    return { success: false, error: err.message };
  }
}

/**
 * ส่ง Flex Message สถานะ "ยกเลิก" ไปยัง LINE OA ของลูกค้า
 * @param {string} userId - LINE User ID ของลูกค้า
 * @param {object} appointmentData - ข้อมูลการจองที่ยกเลิก
 * @param {string} reason - เหตุผลในการยกเลิก
 */
export async function sendAppointmentCancelledFlex(userId, appointmentData, reason = 'ยกเลิกโดยแอดมิน') {
  try {
    console.log('[sendAppointmentCancelledFlex] เริ่มส่ง Flex:', { userId, appointmentData, reason });
    
    const result = await sendAppointmentCancelledFlexMessage(userId, appointmentData, reason);
    console.log('[sendAppointmentCancelledFlex] ส่ง Flex สำเร็จ');
    return result;
  } catch (error) {
    console.error('[sendAppointmentCancelledFlex] ERROR:', error);
    throw error;
  }
}
