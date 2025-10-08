
"use client";
import { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { useRouter } from "next/navigation";

export default function MonthlyDashboardPage() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalWorkorders: 0,
    totalCustomers: 0,
    averageDaily: 0,
    busyDays: 0
  });

  // --- realtime monthly data ---
  // Firestore v9 modular realtime listener
  const fetchAndListenMonthlyData = () => {
    setLoading(true);
    const monthStart = startOfMonth(parseISO(selectedMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    const workordersQuery = query(
      collection(db, "workorders"),
      where("date", ">=", format(monthStart, 'yyyy-MM-dd')),
      where("date", "<=", format(monthEnd, 'yyyy-MM-dd')),
      orderBy("date", "asc")
    );
    const dayBookingQuery = query(collection(db, "dayBookingStatus"));
    let workorders = [];
    let busyStatus = {};
    const recalc = () => {
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const dailyData = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayWorkorders = workorders.filter(w => w.date === dateStr);
        const dayBusyInfo = busyStatus[dateStr] || {};
        const dayRevenue = dayWorkorders.reduce((sum, w) => {
          const price = parseFloat(w.price) || 0;
          return sum + price;
        }, 0);
        const uniqueCustomers = new Set(dayWorkorders.map(w => w.name)).size;
        const statusCounts = {
          'ใหม่': dayWorkorders.filter(w => w.processStatus === 'ใหม่').length,
          'กำลังดำเนินการ': dayWorkorders.filter(w => w.processStatus === 'กำลังดำเนินการ').length,
          'เสร็จสิ้น': dayWorkorders.filter(w => w.processStatus === 'เสร็จสิ้น').length
        };
        return {
          date: dateStr,
          dayName: format(day, 'EEE', { locale: th }),
          dayNumber: format(day, 'd'),
          workordersCount: dayWorkorders.length,
          revenue: dayRevenue,
          customers: uniqueCustomers,
          isBusy: dayBusyInfo.isBusy || false,
          statusCounts,
          workorders: dayWorkorders
        };
      });
      setMonthlyData(dailyData);
      // summary
      const totalRevenue = dailyData.reduce((sum, day) => sum + day.revenue, 0);
      const totalWorkorders = dailyData.reduce((sum, day) => sum + day.workordersCount, 0);
      const totalCustomers = dailyData.reduce((sum, day) => sum + day.customers, 0);
      const busyDays = dailyData.filter(day => day.isBusy).length;
      const workingDays = dailyData.filter(day => day.workordersCount > 0).length;
      setSummary({
        totalRevenue,
        totalWorkorders,
        totalCustomers,
        averageDaily: workingDays > 0 ? totalRevenue / workingDays : 0,
        busyDays
      });
      setLoading(false);
    };
    // subscribe workorders
    const unsubWorkorders = onSnapshot(workordersQuery, (snapshot) => {
      workorders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      recalc();
    });
    // subscribe dayBookingStatus
    const unsubDayBooking = onSnapshot(dayBookingQuery, (snapshot) => {
      busyStatus = {};
      snapshot.docs.forEach(doc => {
        busyStatus[doc.id] = doc.data();
      });
      recalc();
    });
    // cleanup
    return () => {
      if (unsubWorkorders) unsubWorkorders();
      if (unsubDayBooking) unsubDayBooking();
    };
  };

  useEffect(() => {
    // realtime listener
    const cleanup = fetchAndListenMonthlyData();
    return () => {
      if (cleanup) cleanup();
    };
  }, [selectedMonth]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'ใหม่': return 'bg-blue-100 text-blue-800';
      case 'กำลังดำเนินการ': return 'bg-yellow-100 text-yellow-800';
      case 'เสร็จสิ้น': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">แดชบอร์ดรายเดือน</h1>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">เลือกเดือน:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-2 border rounded-md"
          />
          {/* ปุ่มรีเฟรช realtime ไม่จำเป็นแล้ว */}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-sm text-gray-600">รายได้รวม</div>
          <div className="text-2xl font-bold text-green-600">
            {summary.totalRevenue.toLocaleString()} บาท
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-sm text-gray-600">งานทั้งหมด</div>
          <div className="text-2xl font-bold text-blue-600">
            {summary.totalWorkorders} งาน
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-sm text-gray-600">ลูกค้าทั้งหมด</div>
          <div className="text-2xl font-bold text-purple-600">
            {summary.totalCustomers} คน
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <div className="text-sm text-gray-600">เฉลี่ยต่อวัน</div>
          <div className="text-2xl font-bold text-orange-600">
            {Math.round(summary.averageDaily).toLocaleString()} บาท
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <div className="text-sm text-gray-600">วันเต็ม</div>
          <div className="text-2xl font-bold text-red-600">
            {summary.busyDays} วัน
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          ปฏิทินรายเดือน - {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: th })}
        </h2>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">กำลังโหลดข้อมูล...</div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {/* Header days: Sunday first, color-coded */}
            {[
              { label: 'อา', color: 'bg-red-200 text-red-700' },
              { label: 'จ', color: 'bg-yellow-200 text-yellow-700' },
              { label: 'อ', color: 'bg-pink-200 text-pink-700' },
              { label: 'พ', color: 'bg-green-200 text-green-700' },
              { label: 'พฤ', color: 'bg-orange-200 text-orange-700' },
              { label: 'ศ', color: 'bg-blue-200 text-blue-700' },
              { label: 'ส', color: 'bg-purple-200 text-purple-700' }
            ].map(day => (
              <div key={day.label} className={`p-2 text-center font-semibold rounded ${day.color}`}>
                {day.label}
              </div>
            ))}

            {/* Calendar days: adjust so Sunday is first */}
            {monthlyData.map((day) => {
              // day.dayName: 'อา', 'จ', ...
              return (
                <div
                  key={day.date}
                  className={`p-2 border rounded-lg min-h-[120px] cursor-pointer hover:shadow-md transition-shadow ${
                    day.isBusy ? 'bg-red-50 border-red-200 hover:bg-red-100' : 
                    day.workordersCount > 0 ? 'bg-green-50 border-green-200 hover:bg-green-100' : 
                    'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    // Navigate to workorder page with date filter as query string
                    const dateParam = encodeURIComponent(day.date);
                    router.push(`/workorder?date=${dateParam}`);
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-800">{day.dayNumber}</span>
                    {day.isBusy && (
                      <span className="text-xs bg-red-500 text-white px-1 rounded">เต็ม</span>
                    )}
                  </div>
                  {day.workordersCount > 0 && (
                    <>
                      <div className="text-xs mb-1">
                        <div className="font-semibold text-green-600">
                          {day.revenue.toLocaleString()} บาท
                        </div>
                        <div className="text-gray-600">
                          {day.workordersCount} งาน | {day.customers} คน
                        </div>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(day.statusCounts).map(([status, count]) => {
                          if (count > 0) {
                            return (
                              <div key={status} className="flex justify-between text-xs">
                                <span className={`px-1 rounded ${getStatusColor(status)}`}>
                                  {status}
                                </span>
                                <span className="font-semibold">{count}</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}