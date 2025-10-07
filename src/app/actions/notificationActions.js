"use server";

import { db } from '@/app/lib/firebaseAdmin';

export async function markAllNotificationsAsRead() {
  try {
    const notificationsRef = db.collection('notifications');
    const q = notificationsRef.where("isRead", "==", false);
    
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return { success: true, message: "No unread notifications." };
    }

    const batch = db.batch();
    querySnapshot.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();
    
    console.log(`Marked ${querySnapshot.size} notifications as read.`);
    return { success: true };

  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return { success: false, error: error.message };
  }
}


export async function clearAllNotifications() {
  try {
    const notificationsRef = db.collection('notifications');
    const querySnapshot = await notificationsRef.get();

    if (querySnapshot.empty) {
      return { success: true, message: "No notifications to clear." };
    }

    const batch = db.batch();
    querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    console.log(`Cleared ${querySnapshot.size} notifications.`);
    return { success: true };

  } catch (error) {
    console.error("Error clearing notifications:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action สำหรับแจ้งเตือนเมื่อเปลี่ยนสถานะงาน
 */
export async function notifyStatusChange(workorderData, newStatus, oldStatus, customerNotifySettings) {
  const { sendBookingNotification } = await import('./lineActions');
  // ไม่ต้อง import Flex Messages แล้ว - จัดการใน handleInlineEdit
  
  try {
    const { 
      id, 
      type, 
      customerInfo, 
      name, 
      serviceInfo, 
      workorder, 
      serviceName, 
      paymentInfo, 
      price, 
      date, 
      time, 
      appointmentInfo, 
      beauticianName, 
      responsible, 
      userIDline 
    } = workorderData;

    const customerName = type === 'appointment' 
      ? (customerInfo?.fullName || 'ลูกค้า')
      : (name || 'ลูกค้า');
    
    const serviceNameValue = type === 'appointment'
      ? (serviceInfo?.name || workorder || serviceName || 'บริการ')
      : (workorder || serviceName || 'บริการ');
    
    const priceValue = type === 'appointment' 
      ? (paymentInfo?.totalPrice || 0)
      : (price || 0);

    // แจ้งเตือนแอดมิน
    const adminNotificationData = {
      customerName,
      serviceName: serviceNameValue,
      appointmentDate: date,
      appointmentTime: time || '',
      totalPrice: parseInt(priceValue) || 0,
      workStatus: newStatus,
      oldWorkStatus: oldStatus || 'ไม่ระบุ',
      staffName: type === 'appointment' 
        ? (appointmentInfo?.beauticianName || 'พนักงาน')
        : (beauticianName || responsible || 'พนักงาน')
    };
    
    console.log('[WORK STATUS] เตรียมแจ้งเตือนแอดมิน:', adminNotificationData);
    await sendBookingNotification(adminNotificationData, 'workStatusChanged');
    console.log('[WORK STATUS] แจ้งเตือนแอดมินสำเร็จ');

    // แจ้งเตือนลูกค้า (ถ้ามี LINE ID และเปิดการแจ้งเตือน)
    const customerLineId = type === 'appointment' 
      ? customerInfo?.lineUserId 
      : userIDline;

    // ปิดการส่ง Flex Message ทั้งหมดใน notificationActions 
    // เพราะจัดการแล้วใน handleInlineEdit
    if (customerLineId && customerNotifySettings) {
      console.log('[CUSTOMER NOTIFY] ข้าม Flex Message - จัดการแล้วใน handleInlineEdit:', {
        newStatus,
        customerLineId: customerLineId ? 'มี' : 'ไม่มี',
        type: type || 'workorder'
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[WORK STATUS] แจ้งเตือน ERROR:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action สำหรับแจ้งเตือนเมื่อเปลี่ยนสถานะเก็บเงิน
 */
export async function notifyPaymentStatusChange(workorderData, newPaymentStatus, oldPaymentStatus) {
  const { sendBookingNotification } = await import('./lineActions');
  
  try {
    const { 
      type, 
      customerInfo, 
      name, 
      serviceInfo, 
      workorder, 
      serviceName, 
      paymentInfo, 
      price, 
      date, 
      time 
    } = workorderData;

    const customerName = type === 'appointment' 
      ? (customerInfo?.fullName || 'ลูกค้า')
      : (name || 'ลูกค้า');
    
    const serviceNameValue = type === 'appointment'
      ? (serviceInfo?.name || workorder || serviceName || 'บริการ')
      : (workorder || serviceName || 'บริการ');
    
    const priceValue = type === 'appointment' 
      ? (paymentInfo?.totalPrice || 0)
      : (price || 0);

    const notificationData = {
      customerName,
      serviceName: serviceNameValue,
      appointmentDate: date,
      appointmentTime: time || '',
      totalPrice: parseInt(priceValue) || 0,
      paymentStatus: newPaymentStatus,
      oldPaymentStatus: oldPaymentStatus || 'ไม่ระบุ'
    };
    
    console.log('[PAYMENT STATUS] เตรียมแจ้งเตือนแอดมิน:', notificationData);
    await sendBookingNotification(notificationData, 'paymentStatusChanged');
    console.log('[PAYMENT STATUS] แจ้งเตือนแอดมินสำเร็จ');

    return { success: true };
  } catch (error) {
    console.error('[PAYMENT STATUS] แจ้งเตือนแอดมิน ERROR:', error);
    return { success: false, error: error.message };
  }
}
