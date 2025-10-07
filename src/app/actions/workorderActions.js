"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { sendServiceCompletedFlexMessage, sendAppointmentCancelledFlexMessage } from './lineFlexActions';

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
    console.log('[sendWorkorderConfirmedFlex] ฟังก์ชันนี้ถูกปิดใช้งาน - ไม่ส่ง Flex Message แล้ว');
    return { success: true, message: 'Function disabled - no Flex message sent' };
  } catch (error) {
    console.error('[sendWorkorderConfirmedFlex] ERROR:', error);
    throw error;
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
