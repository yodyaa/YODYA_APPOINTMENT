"use server";

import { getShopProfile } from './settingsActions';

/**
 * Creates a Flex Message template for admin notifications
 * Base template with consistent styling for all admin notifications
 */
async function createAdminBaseTemplate(title, titleColor, data) {
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    return {
        type: "flex",
        altText: title,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: title,
                        weight: "bold",
                        size: "lg",
                        color: titleColor,
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: "#E0E0E0"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: data.map(item => ({
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                {
                                    type: "text",
                                    text: item.label,
                                    size: "sm",
                                    color: "#666666",
                                    flex: 2
                                },
                                {
                                    type: "text",
                                    text: item.value,
                                    size: "sm",
                                    color: "#333333",
                                    flex: 3,
                                    wrap: true,
                                    align: "end"
                                }
                            ]
                        })),
                        spacing: "sm",
                        margin: "lg",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "แจ้งเตือนจากระบบการจัดการนัดหมาย",
                                size: "xs",
                                color: "#999999",
                                wrap: true,
                                align: "center"
                            }
                        ],
                        margin: "lg",
                        paddingAll: "8px",
                        backgroundColor: "#F5F5F5",
                        cornerRadius: "6px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

/**
 * Creates Flex Message for new booking notification to admin
 */
export async function createAdminNewBookingFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = notificationData;
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: `${appointmentTime} น.` },
        { label: "ยอดรวม", value: `${Number(totalPrice).toLocaleString()} ${currencySymbol}` }
    ];
    
    return await createAdminBaseTemplate("จองคิวใหม่", "#4CAF50", data);
}

/**
 * Creates Flex Message for payment received notification to admin
 */
export async function createAdminPaymentReceivedFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = notificationData;
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: `${appointmentTime} น.` },
        { label: "ยอดชำระ", value: `${Number(totalPrice).toLocaleString()} ${currencySymbol}` }
    ];
    
    return await createAdminBaseTemplate("ได้รับชำระเงิน", "#FF9800", data);
}

/**
 * Creates Flex Message for customer confirmed notification to admin
 */
export async function createAdminCustomerConfirmedFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime } = notificationData;
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: `${appointmentTime} น.` }
    ];
    
    return await createAdminBaseTemplate("ลูกค้ายืนยันนัดหมาย", "#2196F3", data);
}

/**
 * Creates Flex Message for booking cancelled notification to admin
 */
export async function createAdminBookingCancelledFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime, reason } = notificationData;
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: `${appointmentTime} น.` }
    ];
    
    if (reason) {
        data.push({ label: "เหตุผล", value: reason });
    }
    
    return await createAdminBaseTemplate("ยกเลิกการจอง", "#F44336", data);
}

/**
 * Creates Flex Message for workorder created notification to admin
 */
export async function createAdminWorkorderCreatedFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice, staffName } = notificationData;
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: appointmentTime ? `${appointmentTime} น.` : 'ไม่ระบุ' },
        { label: "พนักงาน", value: staffName },
        { label: "ราคา", value: totalPrice > 0 ? `${Number(totalPrice).toLocaleString()} ${currencySymbol}` : 'ไม่ระบุ' }
    ];
    
    return await createAdminBaseTemplate("สร้างงานใหม่", "#9C27B0", data);
}

/**
 * Creates Flex Message for workorder assigned notification to admin
 */
export async function createAdminWorkorderAssignedFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice, staffName, caseNumber } = notificationData;
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: appointmentTime ? `${appointmentTime} น.` : 'ไม่ระบุ' },
        { label: "พนักงาน", value: staffName },
        { label: "เคสที่", value: caseNumber || 'ไม่ระบุ' },
        { label: "ราคา", value: totalPrice > 0 ? `${Number(totalPrice).toLocaleString()} ${currencySymbol}` : 'ไม่ระบุ' }
    ];
    
    return await createAdminBaseTemplate("มอบหมายงานจากนัดหมาย", "#673AB7", data);
}

/**
 * Creates Flex Message for payment status changed notification to admin
 */
export async function createAdminPaymentStatusChangedFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice, paymentStatus, oldPaymentStatus } = notificationData;
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: appointmentTime ? `${appointmentTime} น.` : 'ไม่ระบุ' },
        { label: "ราคา", value: totalPrice > 0 ? `${Number(totalPrice).toLocaleString()} ${currencySymbol}` : 'ไม่ระบุ' },
        { label: "สถานะเดิม", value: oldPaymentStatus },
        { label: "สถานะใหม่", value: paymentStatus }
    ];
    
    return await createAdminBaseTemplate("เปลี่ยนสถานะเก็บเงิน", "#FF5722", data);
}

/**
 * Creates Flex Message for work status changed notification to admin
 */
export async function createAdminWorkStatusChangedFlexTemplate(notificationData) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice, workStatus, oldWorkStatus, staffName } = notificationData;
    const { profile } = await getShopProfile();
    const currencySymbol = profile.currencySymbol || 'บาท';
    
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const data = [
        { label: "ลูกค้า", value: customerName },
        { label: "บริการ", value: serviceName },
        { label: "วันที่", value: formattedDate },
        { label: "เวลา", value: appointmentTime ? `${appointmentTime} น.` : 'ไม่ระบุ' },
        { label: "พนักงาน", value: staffName },
        { label: "ราคา", value: totalPrice > 0 ? `${Number(totalPrice).toLocaleString()} ${currencySymbol}` : 'ไม่ระบุ' },
        { label: "สถานะเดิม", value: oldWorkStatus },
        { label: "สถานะใหม่", value: workStatus }
    ];
    
    return await createAdminBaseTemplate("เปลี่ยนสถานะงาน", "#3F51B5", data);
}