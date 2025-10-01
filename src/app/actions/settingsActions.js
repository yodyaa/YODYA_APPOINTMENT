// src/app/actions/settingsActions.js
'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// --- Function to get shop profile settings with cache ---
let shopProfileCache = null;
let cacheTimestamp = null;

export async function getShopProfile() {
    const now = Date.now();
    // Cache for 1 minute to prevent multiple reads in a short time
    if (shopProfileCache && cacheTimestamp && (now - cacheTimestamp < 60000)) {
        return { success: true, profile: shopProfileCache };
    }

    if (!db) {
        return { success: false, error: "Firebase Admin is not initialized." };
    }
    try {
        const docRef = db.collection('settings').doc('profile');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const profileData = docSnap.data();
            shopProfileCache = profileData;
            cacheTimestamp = now;
            return { success: true, profile: profileData };
        } else {
            const defaultProfile = {
                storeName: 'ชื่อร้านค้า',
                currency: '฿',
                currencySymbol: 'บาท',
            };
            return { success: true, profile: defaultProfile };
        }
    } catch (error) {
        console.error("Error getting shop profile:", error);
        return { success: false, error: error.message };
    }
}

export async function saveProfileSettings(settingsData) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const settingsRef = db.collection('settings').doc('profile');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        shopProfileCache = null; // Invalidate cache
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function saveNotificationSettings(settingsData) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const settingsRef = db.collection('settings').doc('notifications');
        // Ensure newBooking toggle exists in customerNotifications
        const updatedSettings = {
            ...settingsData,
            customerNotifications: {
                newBooking: typeof settingsData?.customerNotifications?.newBooking === 'boolean'
                    ? settingsData.customerNotifications.newBooking
                    : true, // default to true if not set
                ...settingsData.customerNotifications
            },
            updatedAt: FieldValue.serverTimestamp(),
        };
        await settingsRef.set(updatedSettings, { merge: true });
        notificationSettingsCache = null; // Invalidate cache
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Function to get notification settings with cache ---
let notificationSettingsCache = null;
let notificationCacheTimestamp = null;

// Helper to make settings serializable
const makeSerializable = (data) => {
    if (!data) return {};
    return JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && value.hasOwnProperty('_seconds') && value.hasOwnProperty('_nanoseconds')) {
            return new Date(value._seconds * 1000 + value._nanoseconds / 1000000).toISOString();
        }
        return value;
    }));
};

export async function getNotificationSettings() {
    const now = Date.now();
    // Cache for 1 minute
    if (notificationSettingsCache && notificationCacheTimestamp && (now - notificationCacheTimestamp < 60000)) {
        return { success: true, settings: notificationSettingsCache }; // Already serialized
    }

    if (!db) {
        return { success: false, error: "Firebase Admin is not initialized." };
    }
    try {
        const docRef = db.collection('settings').doc('notifications');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const settingsData = docSnap.data();
            const serializableSettings = makeSerializable(settingsData);
            
            notificationSettingsCache = serializableSettings; // Cache the serializable version
            notificationCacheTimestamp = now;
            
            return { success: true, settings: serializableSettings };
        } else {
            // Return default settings if not found
            return { success: true, settings: {} };
        }
    } catch (error) {
        console.error("Error getting notification settings:", error);
        return { success: false, error: error.message };
    }
}

export async function saveBookingSettings(settingsData) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const settingsRef = db.collection('settings').doc('booking');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function savePointSettings(settingsData) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const settingsRef = db.collection('settings').doc('points');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function savePaymentSettings(settingsData) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const settingsRef = db.collection('settings').doc('payment');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error saving payment settings:", error);
        return { success: false, error: error.message };
    }
}

export async function saveCalendarSettings(settingsData) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const settingsRef = db.collection('settings').doc('calendar');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error saving calendar settings:", error);
        return { success: false, error: error.message };
    }
}

export async function getPaymentSettings() {
    if (!db) {
        console.error("Firebase Admin SDK has not been initialized.");
        return { success: false, error: "บริการ Firebase ไม่พร้อมใช้งาน" };
    }

    try {
        const docRef = db.collection('settings').doc('payment');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const settingsData = docSnap.data();
            const serializableSettings = JSON.parse(JSON.stringify(settingsData, (key, value) => {
                if (value && value.hasOwnProperty('_seconds') && value.hasOwnProperty('_nanoseconds')) {
                    return new Date(value._seconds * 1000 + value._nanoseconds / 1000000).toISOString();
                }
                return value;
            }));
            return { success: true, settings: serializableSettings };
        } else {
            return { success: false, error: "ยังไม่ได้ตั้งค่าการชำระเงิน" };
        }
    } catch (error) {
        console.error("Error getting payment settings:", error);
        return { success: false, error: error.message };
    }
}