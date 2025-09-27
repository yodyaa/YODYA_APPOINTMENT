"use client";
import { workorders } from "@/app/(employee)/workorder";

import Link from "next/link";

export default function WorkorderAdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">สถานะงานช่าง</h1>
      <div className="flex gap-4 mb-6">
        <Link href="/workorder" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-indigo-700">งานทั้งหมด</Link>
        <Link href="/workorder/create" className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700">สร้างงาน</Link>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">รหัสงาน</th>
              <th className="p-2 border">งาน</th>
              <th className="p-2 border">สถานะ</th>
              <th className="p-2 border">ชื่อช่าง</th>
              <th className="p-2 border">วันที่</th>
              <th className="p-2 border">ผู้รับผิดชอบ</th>
              <th className="p-2 border">รายละเอียด</th>
              <th className="p-2 border">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {workorders.map((w) => (
              <tr key={w.idKey} className="border-b">
                <td className="p-2 border">{w.idKey}</td>
                <td className="p-2 border">{w.workorder}</td>
                <td className="p-2 border">{w.processStatus}</td>
                <td className="p-2 border">{w.responsible}</td>
                <td className="p-2 border">{w.date}</td>
                <td className="p-2 border">{w.name}</td>
                <td className="p-2 border">{w.detail}</td>
                <td className="p-2 border">{w.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
