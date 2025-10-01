"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { sendServiceCompletedFlexMessage, sendAppointmentConfirmedFlexMessage } from './lineFlexActions';

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

    // อ่าน toggle จาก settings (optional: สามารถเพิ่ม logic ดึงจาก Firestore ได้)
    // ตัวอย่างนี้เปิด true ตลอด
    const notifyProcessing = true;
    const notifyCompleted = true;

    if (field === 'processStatus' && customerLineId) {
      try {
        if (value === 'กำลังดำเนินการ' && notifyProcessing) {
          console.log('[WORKORDER][updateWorkorderStatusByAdmin] sendAppointmentConfirmedFlexMessage', { customerLineId, workorderData });
          await sendAppointmentConfirmedFlexMessage(customerLineId, workorderData);
        } else if (value === 'เสร็จสิ้น' && notifyCompleted) {
          console.log('[WORKORDER][updateWorkorderStatusByAdmin] sendServiceCompletedFlexMessage', { customerLineId, workorderData });
          await sendServiceCompletedFlexMessage(customerLineId, workorderData);
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
 * @param {string} userId - LINE User ID ของลูกค้า
 * @param {object} workorderData - ข้อมูลงานที่สร้าง
 */
export async function sendWorkorderConfirmedFlex(userId, workorderData) {
  try {
    console.log('[sendWorkorderConfirmedFlex] เริ่มส่ง Flex:', { userId, workorderData });
    
    // สร้าง payload ที่เหมาะสมกับ Flex Template (ต้องมี customerInfo, serviceInfo)
    const payload = {
      serviceName: workorderData.serviceName || workorderData.workorder || 'งานบริการ',
      date: workorderData.date,
      time: workorderData.time || '',
      appointmentId: workorderData.appointmentId || workorderData.bookingId || workorderData.idKey || workorderData.id,
      id: workorderData.id || workorderData.appointmentId || workorderData.bookingId || workorderData.idKey,
      // เพิ่ม customerInfo ถ้ามี
      customerInfo: {
        fullName: workorderData.customerInfo?.fullName || workorderData.name || 'คุณลูกค้า',
      },
      // เพิ่ม serviceInfo ถ้ามี
      serviceInfo: {
        name: workorderData.serviceInfo?.name || workorderData.serviceName || workorderData.workorder || 'งานบริการ',
      },
    };
    
    console.log('[sendWorkorderConfirmedFlex] Payload:', payload);
    const result = await sendAppointmentConfirmedFlexMessage(userId, payload);
    console.log('[sendWorkorderConfirmedFlex] ผลลัพธ์:', result);
    return result;
  } catch (error) {
    console.error('[sendWorkorderConfirmedFlex] ERROR:', error);
    throw error;
  }
}
