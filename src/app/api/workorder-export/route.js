import { NextResponse } from "next/server";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

// API Key สำหรับยืนยันตัวตน (ควรเก็บใน environment variable)
const API_KEY = process.env.WORKORDER_API_KEY || "your-secret-api-key";

// ฟังก์ชันเรียงลำดับตาม caseNumber แบบ natural sorting
function sortByCaseNumber(items) {
  const parseCase = (caseStr) => {
    if (!caseStr) return [Infinity, 0];
    const parts = String(caseStr).split('.');
    const main = parseInt(parts[0]) || Infinity;
    const sub = parseInt(parts[1]) || 0;
    return [main, sub];
  };

  return [...items].sort((a, b) => {
    const [aMain, aSub] = parseCase(a.caseNumber);
    const [bMain, bSub] = parseCase(b.caseNumber);
    if (aMain !== bMain) return aMain - bMain;
    return aSub - bSub;
  });
}

// GET: ดึงข้อมูล workorder ตามวันที่
export async function GET(request) {
  try {
    // ดึง parameters จาก URL
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("apiKey") || request.headers.get("x-api-key");
    const startDate = searchParams.get("startDate") || searchParams.get("date");
    const endDate = searchParams.get("endDate") || startDate;
    const format = searchParams.get("format") || "json"; // json หรือ csv
    const includeAppointments = searchParams.get("includeAppointments") !== "false"; // default true

    // ตรวจสอบ API Key
    if (!apiKey || apiKey !== API_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Unauthorized - Invalid API Key",
          message: "กรุณาระบุ API Key ที่ถูกต้อง"
        },
        { status: 401 }
      );
    }

    // ตรวจสอบว่ามีวันที่หรือไม่
    if (!startDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Missing date parameter",
          message: "กรุณาระบุวันที่ (date หรือ startDate)",
          example: "/api/workorder-export?apiKey=xxx&date=2024-12-23"
        },
        { status: 400 }
      );
    }

    // สร้างรายการวันที่
    const datesToExport = [];
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);
    const current = new Date(start);
    
    while (current <= end) {
      datesToExport.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // ดึงข้อมูลจาก Firestore
    const workordersSnapshot = await getDocs(collection(db, "workorders"));
    const allWorkorders = workordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'workorder'
    }));

    // ดึง appointments (ถ้าต้องการ)
    let allAppointments = [];
    if (includeAppointments) {
      const appointmentsSnapshot = await getDocs(collection(db, "appointments"));
      allAppointments = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'appointment',
        caseNumber: doc.data().caseNumber || doc.id?.substring(0, 3),
      }));
    }

    // ดึง services สำหรับข้อมูลราคา
    const servicesSnapshot = await getDocs(collection(db, "services"));
    const services = servicesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // กรองข้อมูลตามวันที่
    const exportData = datesToExport.map(dateStr => {
      // กรอง workorders
      const dayWorkorders = allWorkorders.filter(w => w.date === dateStr);
      
      // กรอง appointments
      const dayAppointments = allAppointments.filter(a => a.date === dateStr);
      
      // รวมและเรียงลำดับ
      const combined = [...dayWorkorders, ...dayAppointments];
      const sortedItems = sortByCaseNumber(combined);

      return {
        date: dateStr,
        dateFormatted: new Date(dateStr).toLocaleDateString('th-TH', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        totalItems: sortedItems.length,
        items: sortedItems.map(w => {
          const service = services.find(s => s.serviceName === w.workorder || s.name === w.workorder);
          const price = w.price !== undefined && w.price !== null && w.price !== '' 
            ? Number(w.price) 
            : (service?.price || 0);
          
          return {
            id: w.id,
            type: w.type,
            caseNumber: w.caseNumber || '-',
            time: w.time || '-',
            flexibility: w.flexibility || '-',
            customerName: w.type === 'appointment' 
              ? (w.customerInfo?.fullName || '-') 
              : (w.name || '-'),
            customerPhone: w.type === 'appointment'
              ? (w.customerInfo?.phone || '-')
              : (w.phone || '-'),
            service: w.type === 'appointment' 
              ? (w.serviceInfo?.name || w.workorder || '-') 
              : (w.workorder || '-'),
            price: price,
            processStatus: w.processStatus || '-',
            paymentStatus: w.type === 'appointment' 
              ? (w.paymentInfo?.paymentStatus || '-') 
              : (w.paymentStatus || '-'),
            beautician: w.type === 'appointment' 
              ? (w.appointmentInfo?.beauticianName || '-') 
              : (w.beauticianName || w.responsible || '-'),
            notes: w.notes || w.workNote || '-',
            rowColor: w.rowColor || '#ffffff',
            createdAt: w.createdAt || null,
            updatedAt: w.updatedAt || null
          };
        })
      };
    });

    // คำนวณสรุป
    const summary = {
      totalDays: datesToExport.length,
      totalItems: exportData.reduce((sum, day) => sum + day.totalItems, 0),
      totalRevenue: exportData.reduce((sum, day) => {
        return sum + day.items.reduce((daySum, item) => daySum + Number(item.price || 0), 0);
      }, 0),
      dateRange: {
        start: startDate,
        end: endDate || startDate
      }
    };

    // ถ้าต้องการ CSV
    if (format === "csv") {
      let csvContent = '\uFEFF'; // BOM for UTF-8
      
      exportData.forEach(dayData => {
        csvContent += `\n=== ${dayData.dateFormatted} ===\n`;
        csvContent += 'ID,ประเภท,เคสที่,เวลา,ความยืดหยุ่น,ลูกค้า,เบอร์โทร,บริการ,ราคา,สถานะงาน,สถานะเก็บเงิน,ช่าง,หมายเหตุ\n';
        
        if (dayData.items.length === 0) {
          csvContent += 'ไม่มีงานในวันนี้\n';
        } else {
          dayData.items.forEach(item => {
            csvContent += `${item.id},${item.type},${item.caseNumber},"${item.time}","${item.flexibility}","${item.customerName}","${item.customerPhone}","${item.service}",${item.price},${item.processStatus},${item.paymentStatus},"${item.beautician}","${item.notes}"\n`;
          });
          // สรุปรายได้
          const totalRevenue = dayData.items.reduce((sum, item) => sum + Number(item.price || 0), 0);
          csvContent += `,,,,,,รวม,"${totalRevenue.toLocaleString()} บาท",,,,\n`;
        }
      });

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="workorder_export_${startDate}${endDate && endDate !== startDate ? '_to_' + endDate : ''}.csv"`,
        }
      });
    }

    // ส่งข้อมูล JSON
    return NextResponse.json({
      success: true,
      message: "ดึงข้อมูลสำเร็จ",
      summary,
      data: exportData,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("[API] Error exporting workorders:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal Server Error",
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST: ดึงข้อมูลด้วย Body (สำหรับระบบที่ต้องการส่ง parameters แบบ Body)
export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || request.headers.get("x-api-key");
    
    // ตรวจสอบ API Key
    if (!apiKey || apiKey !== API_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Unauthorized - Invalid API Key"
        },
        { status: 401 }
      );
    }

    const { startDate, endDate, date, includeAppointments = true, format = "json" } = body;
    const actualStartDate = startDate || date;
    const actualEndDate = endDate || actualStartDate;

    if (!actualStartDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Missing date parameter",
          message: "กรุณาระบุวันที่ (date หรือ startDate)"
        },
        { status: 400 }
      );
    }

    // สร้าง URL params และเรียก GET handler
    const url = new URL(request.url);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("startDate", actualStartDate);
    url.searchParams.set("endDate", actualEndDate);
    url.searchParams.set("includeAppointments", String(includeAppointments));
    url.searchParams.set("format", format);

    // เรียกใช้ GET handler
    const newRequest = new Request(url.toString(), {
      method: "GET",
      headers: request.headers
    });

    return GET(newRequest);

  } catch (error) {
    console.error("[API] Error in POST:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal Server Error",
        message: error.message
      },
      { status: 500 }
    );
  }
}
