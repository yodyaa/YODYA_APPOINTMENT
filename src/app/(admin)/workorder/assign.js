"use client";
import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";

export default function AssignWorkorderPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        // ดึงเฉพาะการจองที่ยังไม่ถูกมอบหมาย
        const q = query(collection(db, "appointments"), where("assigned", "!=", true));
        const snapshot = await getDocs(q);
        setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">มอบหมายงานจากการจอง</h1>
      {loading ? (
        <div className="text-center py-8">กำลังโหลดข้อมูล...</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ไม่มีการจองที่รอมอบหมายงาน</div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">รหัสการจอง</th>
                <th className="p-2 border">ชื่อ</th>
                <th className="p-2 border">เบอร์</th>
                <th className="p-2 border">วันที่</th>
                <th className="p-2 border">เวลา</th>
                <th className="p-2 border">บริการ</th>
                <th className="p-2 border">มอบหมาย</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(appt => (
                <tr key={appt.id} className="border-b">
                  <td className="p-2 border">{appt.id}</td>
                  <td className="p-2 border">{appt.fullName || appt.customerName}</td>
                  <td className="p-2 border">{appt.phone}</td>
                  <td className="p-2 border">{appt.date}</td>
                  <td className="p-2 border">{appt.time}</td>
                  <td className="p-2 border">{appt.serviceName}</td>
                  <td className="p-2 border">
                    <Link href={`/workorder/create?from=${appt.id}`} className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">มอบหมายงาน</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
