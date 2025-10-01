"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
// Removed point logic: mergePointsFromPhone, checkPhonePointsForMerge
// Removed unused import: import { awardPointsForVisit } from './pointActions';

/**
 * Find or create customer with automatic points merging when LINE ID is connected
 * @param {object} customerData - Customer data including phone, fullName, email
 * @param {string} userId - LINE User ID (if available)
 * @returns {Promise<{success: boolean, customerId?: string, mergedPoints?: number, error?: string}>}
 */
export async function findOrCreateCustomer(customerData, userId) {
    if (!customerData?.phone && !userId) {
        return {
            success: false,
            error: 'Phone number or User ID is required.'
        };
    }

    const customersRef = db.collection('customers');
    let customerQuery;
    let customerDocRef; // Declare here to be accessible throughout the function

    // Prioritize finding customer by LINE User ID if available
    if (userId) {
        // Use the userId directly as the document ID
        customerDocRef = customersRef.doc(userId);
        const customerDoc = await customerDocRef.get();
        customerQuery = customerDoc.exists ? [customerDoc] : [];
    } else {
        // Fallback to querying by phone number if no userId
        const q = customersRef.where('phone', '==', customerData.phone).limit(1);
        const snapshot = await q.get();
        customerQuery = snapshot.docs;
        // Set customerDocRef for phone-based customers
        if (customerQuery.length > 0) {
            customerDocRef = customerQuery[0].ref;
        }
    }

    try {
        let customerId;

        if (customerQuery.length > 0) {
            const customerDoc = customerQuery[0];
            customerId = customerDoc.id;

            const updateData = {
                updatedAt: FieldValue.serverTimestamp(),
            };

            if (customerData.fullName) updateData.fullName = customerData.fullName;
            if (customerData.email) updateData.email = customerData.email;
            if (customerData.phone) updateData.phone = customerData.phone;

            if (userId && customerData.phone && !customerDoc.data().userId) {
                updateData.userId = userId;
            }

            await customerDocRef.update(updateData);
            console.log(`Updated customer ${customerId} with ${Object.keys(updateData).length} fields.`);

        } else {
            const newCustomerRef = userId ? customersRef.doc(userId) : customersRef.doc();
            const newCustomerData = {
                fullName: customerData.fullName,
                phone: customerData.phone,
                email: customerData.email || '',
                userId: userId || null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await newCustomerRef.set(newCustomerData);
            customerId = newCustomerRef.id;
            console.log(`Created new customer ${customerId}.`);
        }

        return {
            success: true,
            customerId: customerId
        };

    } catch (error) {
        console.error("Error in findOrCreateCustomer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Connect LINE ID to existing customer by phone number
 * @param {string} phoneNumber - Customer's phone number
 * @param {string} userId - LINE User ID
 * @param {object} additionalData - Additional customer data (optional)
 * @returns {Promise<{success: boolean, customerId?: string, mergedPoints?: number, message?: string, error?: string}>}
 */
export async function connectLineToCustomer(phoneNumber, userId, additionalData = {}) {
    if (!phoneNumber || !userId) {
        return {
            success: false,
            error: 'เบอร์โทรศัพท์และ LINE User ID จำเป็นต้องระบุ'
        };
    }

    try {
        // Check if LINE ID already exists
        const existingLineCustomer = await db.collection('customers').doc(userId).get();
        if (existingLineCustomer.exists) {  // Admin SDK uses .exists property
            return {
                success: false,
                error: 'LINE ID นี้ถูกใช้งานแล้ว'
            };
        }

        // Find customer by phone number in main customers collection
        const phoneQuery = db.collection('customers').where('phone', '==', phoneNumber).limit(1);
        const phoneSnapshot = await phoneQuery.get();

        let customerId;

        if (!phoneSnapshot.empty) {
            const existingCustomer = phoneSnapshot.docs[0];
            const existingData = existingCustomer.data();
            
            if (existingData.userId) {
                return {
                    success: false,
                    error: 'ลูกค้ารายนี้มี LINE ID เชื่อมต่ออยู่แล้ว'
                };
            }

            const newCustomerRef = db.collection('customers').doc(userId);
            const newCustomerData = {
                ...existingData,
                ...additionalData,
                userId: userId,
                phoneNumber: phoneNumber,
                connectedLineAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await newCustomerRef.set(newCustomerData);
            await existingCustomer.ref.delete();
            customerId = userId;
            console.log(`Moved customer from ${existingCustomer.id} to LINE ID ${userId}`);

        } else {
            customerId = userId;
        }

        if (phoneSnapshot.empty) {
            const newCustomerData = {
                fullName: additionalData.fullName || '',
                phone: phoneNumber,
                email: additionalData.email || '',
                userId: userId,
                connectedLineAt: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await db.collection('customers').doc(userId).set(newCustomerData);
            console.log(`Created new customer ${userId} with LINE connection.`);
        }

        return {
            success: true,
            customerId: userId,
            message: 'เชื่อมต่อ LINE สำเร็จ'
        };

    } catch (error) {
        console.error("Error connecting LINE to customer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Adds a new customer to Firestore.
 * @param {object} customerData - The data for the new customer.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function addCustomer(customerData) {
  try {
    // ใช้ синтаксис ของ Admin SDK
        await db.collection('customers').add({
            ...customerData,
            createdAt: FieldValue.serverTimestamp(),
        });
    revalidatePath('/admin/customers');
    return { success: true, message: 'เพิ่มลูกค้าสำเร็จ!' };
  } catch (error) {
    console.error("Error adding customer:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a customer from Firestore.
 * @param {string} customerId - The ID of the customer to delete.
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function deleteCustomer(customerId) {
  try {
    // ใช้ синтаксис ของ Admin SDK
    await db.collection('customers').doc(customerId).delete();
    revalidatePath('/admin/customers');
    return { success: true, message: 'ลบลูกค้าสำเร็จ!' };
  } catch (error) {
    console.error("Error deleting customer:", error);
    return { success: false, error: error.message };
  }
}