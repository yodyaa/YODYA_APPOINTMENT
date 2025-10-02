"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin';
import { sendAppointmentReminderFlexMessage } from './lineFlexActions';
import axios from 'axios';
// Removed telegram logic: sendTelegramMessageToAdmin
import { getNotificationSettings, getShopProfile } from './settingsActions';
import {
    createAdminNewBookingFlexTemplate,
    createAdminPaymentReceivedFlexTemplate,
    createAdminCustomerConfirmedFlexTemplate,
    createAdminBookingCancelledFlexTemplate,
    createAdminWorkorderCreatedFlexTemplate,
    createAdminWorkorderAssignedFlexTemplate,
    createAdminPaymentStatusChangedFlexTemplate,
    createAdminWorkStatusChangedFlexTemplate
} from './adminFlexTemplateActions';


const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

/**
 * Sends a push message to a single LINE user, checking customer notification settings first.
 */
export async function sendLineMessage(to, messageText, notificationType) {
  if (!to || !messageText) {
    console.error("Missing 'to' or 'messageText'");
    return { success: false, error: "Missing recipient or message." };
  }
  
  const { success, settings } = await getNotificationSettings();
  if (!success || !settings.customerNotifications?.[notificationType]) {
      console.log(`Customer notification for type '${notificationType}' is disabled.`);
      return { success: true, message: "Customer notifications disabled for this type." };
  }

  try {
    const messageObject = { type: 'text', text: messageText };
    await client.pushMessage(to, messageObject);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send message to ${to}:`, error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Sends a multicast message to all registered admins, checking admin notification settings first.
 */
export async function sendLineMessageToAllAdmins(messageText, notificationType) {
  const { success, settings } = await getNotificationSettings();
  const isMasterEnabled = settings.allNotifications?.enabled;
  const isAdminGroupEnabled = settings.adminNotifications?.enabled;
  
  // Default to true for workorder notifications if not set in Firestore
  let isNotificationTypeEnabled = true;
  if (notificationType) {
    if (settings.adminNotifications?.[notificationType] !== undefined) {
      isNotificationTypeEnabled = settings.adminNotifications[notificationType];
    } else if (notificationType === 'workorderCreated' || notificationType === 'workorderAssigned' || notificationType === 'paymentStatusChanged' || notificationType === 'workStatusChanged') {
      // Default workorder and payment notifications to enabled if not configured
      isNotificationTypeEnabled = true;
    } else {
      isNotificationTypeEnabled = settings.adminNotifications?.[notificationType] || false;
    }
  }

  if (!success || !isMasterEnabled || !isAdminGroupEnabled || !isNotificationTypeEnabled) {
      console.log(`Admin LINE notification for type '${notificationType}' is disabled. Master: ${isMasterEnabled}, AdminGroup: ${isAdminGroupEnabled}, Type: ${isNotificationTypeEnabled}`);
      return { success: true, message: "Admin notifications disabled for this type." };
  }

  try {
    // [!code focus start]
    // 1. ดึงข้อมูลแอดมินทั้งหมดเพื่อตรวจสอบ
    const allAdminsSnapshot = await db.collection('admins').get();
    const totalAdmins = allAdminsSnapshot.size;

    // 2. กรองเฉพาะแอดมินที่มี lineUserId
    const adminLineIds = allAdminsSnapshot.docs
      .map(doc => doc.data().lineUserId)
      .filter(id => id); //กรองเอาเฉพาะ id ที่มีค่า
    
    const totalAdminsWithLineId = adminLineIds.length;

    // 3. แสดง Log เพื่อการตรวจสอบ
    console.log(`[Admin Notification Check] Total admin users found: ${totalAdmins}`);
    console.log(`[Admin Notification Check] Admins with lineUserId: ${totalAdminsWithLineId}`);
    // [!code focus end]

    if (totalAdminsWithLineId === 0) {
      console.warn("No admins with lineUserId found to notify.");
      return { success: true, message: "No admins to notify." };
    }
    
    console.log(`[Admin Notification Check] Sending notification to IDs: ${adminLineIds.join(', ')}`);

    // Use Flex message if available, otherwise fallback to text
    let messageObject;
    if (typeof messageText === 'object' && messageText.type === 'flex') {
      messageObject = messageText;
    } else {
      messageObject = { type: 'text', text: messageText };
    }
    
    await client.multicast(adminLineIds, [messageObject]);

    return { success: true };

  } catch (error) {
    console.error('Error sending multicast message to admins:', error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message to admins' };
  }
}

/**
 * Send booking notification to admins via LINE Notify and LINE Bot
 */
async function createMessage(details, type) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = details;
    
    switch (type) {
        case 'newBooking':
            return await createAdminNewBookingFlexTemplate(details);
        case 'paymentReceived':
            return await createAdminPaymentReceivedFlexTemplate(details);
        case 'customerConfirmed':
            return await createAdminCustomerConfirmedFlexTemplate(details);
        case 'bookingCancelled':
            return await createAdminBookingCancelledFlexTemplate(details);
        case 'workorderCreated':
            return await createAdminWorkorderCreatedFlexTemplate(details);
        case 'workorderAssigned':
            return await createAdminWorkorderAssignedFlexTemplate(details);
        case 'paymentStatusChanged':
            return await createAdminPaymentStatusChangedFlexTemplate(details);
        case 'workStatusChanged':
            return await createAdminWorkStatusChangedFlexTemplate(details);
        default:
            // Fallback to text message for unknown types
            const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            const { profile } = await getShopProfile();
            const currencySymbol = profile.currencySymbol || 'บาท';
            return `การแจ้งเตือนใหม่\nลูกค้า: ${customerName}\nบริการ: ${serviceName}\nวันที่: ${formattedDate}\nเวลา: ${appointmentTime} น.`;
    }
}

export async function sendBookingNotification(details, type) {
    // การตรวจสอบสิทธิ์จะเกิดขึ้นใน sendLineMessageToAllAdmins แล้ว
    const message = await createMessage(details, type);
    
    const { success, settings } = await getNotificationSettings();
    if (success && settings.lineNotifications?.notifyToken) {
        try {
            // For LINE Notify, convert Flex to text
            let textMessage;
            if (typeof message === 'object' && message.type === 'flex') {
                textMessage = message.altText || 'แจ้งเตือนใหม่';
            } else {
                textMessage = message;
            }
            
            await axios.post('https://notify-api.line.me/api/notify', `message=${textMessage}`, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${settings.lineNotifications.notifyToken}`,
                },
            });
        } catch (error) {
          console.error('Error sending LINE Notify message:', error.response ? error.response.data : error.message);
        }
    }

    // Send Flex message to admins via LINE Bot
    await sendLineMessageToAllAdmins(message, type);

    return { success: true };
}

export async function sendReminderNotification(customerLineId, bookingData) {
    const { success, settings } = await getNotificationSettings();
    const notificationType = 'appointmentReminder'; // Corrected notification type

    if (!success || !settings?.customerNotifications?.[notificationType]) {
        console.log(`Customer notification for type '${notificationType}' is disabled.`);
        return { success: true, message: `Customer notifications for '${notificationType}' are disabled.` };
    }

    return await sendAppointmentReminderFlexMessage(customerLineId, bookingData);
}