"use client";
import React, { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WorkorderDetailPage({ params }) {
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const resolvedParams = React.use(params);
  const { id } = resolvedParams;
  
  const [workorder, setWorkorder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkorder = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "workorders", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setWorkorder(data);
        } else {
          alert("ไม่พบข้อมูลงานที่ต้องการดู");
          router.back();
        }
      } catch (err) {
        console.error("Error fetching workorder:", err);
        alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchWorkorder();
    }
  }, [id, router]);

  // When workorder loaded, update editFields only if not in edit mode
  useEffect(() => {
    if (workorder && !editMode) {
      setEditFields({ ...workorder });
    }
  }, [workorder, editMode]);

  const safe = (val, fallback = "-") => (val !== undefined && val !== null && val !== "" ? val : fallback);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-gray-500">กำลังโหลดข้อมูลงาน...</div>
        </div>
      </div>
    );
  }

  if (!workorder) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-red-500">ไม่พบข้อมูลงาน</div>
        </div>
      </div>
    );
  }

  return (
  <div className="container mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">รายละเอียดงาน</h1>
          <p className="text-gray-600 mt-1 text-sm">รหัสงาน: {safe(workorder.idKey)}</p>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setSaveError("");
                  try {
                    await updateDoc(doc(db, 'workorders', workorder.id), {
                      ...editFields,
                      updatedAt: new Date().toISOString()
                    });
                    setWorkorder(w => ({ ...w, ...editFields }));
                    setEditMode(false);
                  } catch (err) {
                    setSaveError('เกิดข้อผิดพลาดในการบันทึก');
                  } finally {
                    setSaving(false);
                  }
                }}
              >บันทึก</button>
              <button
                className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
                disabled={saving}
                onClick={() => { setEditMode(false); setEditFields({ ...workorder }); setSaveError(""); }}
              >ยกเลิก</button>
            </>
          ) : (
            <>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                onClick={() => setEditMode(true)}
              >แก้ไข</button>
              <button
                className="px-3 py-1 bg-pink-500 text-white rounded hover:bg-pink-600 text-sm"
                onClick={async () => {
                  // Duplicate workorder
                  try {
                    const { addDoc, collection } = await import('firebase/firestore');
                    const newData = { ...workorder };
                    delete newData.id;
                    newData.idKey = 'COPY-' + (workorder.idKey || new Date().getTime().toString());
                    newData.createdAt = new Date().toISOString();
                    newData.processStatus = 'ใหม่';
                    newData.status = 'awaiting_confirmation';
                    const docRef = await addDoc(collection(db, 'workorders'), newData);
                    alert('คัดลอกงานสำเร็จ!');
                    router.push(`/workorder/edit/${docRef.id}`);
                  } catch (err) {
                    alert('เกิดข้อผิดพลาดในการคัดลอกงาน');
                  }
                }}
              >คัดลอกงาน</button>
              <button
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                onClick={async () => {
                  if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้? การกระทำนี้ไม่สามารถยกเลิกได้')) {
                    try {
                      const { deleteDoc } = await import('firebase/firestore');
                      await deleteDoc(doc(db, 'workorders', workorder.id));
                      alert('ลบงานสำเร็จ!');
                      router.push('/workorder');
                    } catch (err) {
                      alert('เกิดข้อผิดพลาดในการลบงาน');
                    }
                  }
                }}
              >ลบงาน</button>
            </>
          )}
        </div>
      </div>

      {/* 4 Columns Section */}
      {saveError && (
        <div className="text-red-500 text-center mb-2">{saveError}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* ข้อมูลงาน */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">ข้อมูลงาน</h2>
          <div className="space-y-2">
            <div>
              <label className="block font-medium text-gray-600 mb-1">ชื่องาน/บริการ</label>
              {editMode ? (
                <input
                  type="text"
                  className="font-semibold text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.workorder === 'string' ? editFields.workorder : (editFields.workorder ? String(editFields.workorder) : '')}
                  onChange={e => setEditFields(f => ({ ...f, workorder: e.target.value }))}
                />
              ) : (
                <div className="font-semibold text-gray-800 bg-gray-50 p-2 rounded">{safe(workorder.workorder)}</div>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">สถานะงาน</label>
              {editMode ? (
                <select
                  className="px-3 py-1 rounded-full text-xs font-medium w-full"
                  value={editFields.processStatus || ''}
                  onChange={e => setEditFields(f => ({ ...f, processStatus: e.target.value }))}
                >
                  <option value="อยู่ในแผนงาน">อยู่ในแผนงาน</option>
                  <option value="ช่างกำลังดำเนินการ">ช่างกำลังดำเนินการ</option>
                  <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  workorder.processStatus === 'อยู่ในแผนงาน' ? 'bg-blue-100 text-blue-800' :
                  workorder.processStatus === 'ช่างกำลังดำเนินการ' ? 'bg-yellow-100 text-yellow-800' :
                  workorder.processStatus === 'เสร็จสิ้น' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {safe(workorder.processStatus)}
                </span>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">วันที่</label>
              {editMode ? (
                <input
                  type="date"
                  className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.date === 'string' ? editFields.date : (editFields.date ? String(editFields.date) : '')}
                  onChange={e => setEditFields(f => ({ ...f, date: e.target.value }))}
                />
              ) : (
                <div className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded">{safe(workorder.date)}</div>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">เวลา</label>
              {editMode ? (
                <input
                  type="time"
                  className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.time === 'string' ? editFields.time : (editFields.time ? String(editFields.time) : '')}
                  onChange={e => setEditFields(f => ({ ...f, time: e.target.value }))}
                />
              ) : (
                <div className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded">{safe(workorder.time, "ไม่ระบุ")}</div>
              )}
            </div>
            {/* ...removed เคสที่, ช่างรับผิดชอบ, ราคา from this column... */}
            <div>
              <label className="block font-medium text-gray-600 mb-1">รายละเอียดงาน</label>
              {editMode ? (
                <textarea
                  className="text-sm text-gray-800 bg-blue-50 p-2 rounded w-full"
                  value={typeof editFields.detail === 'string' ? editFields.detail : (editFields.detail ? String(editFields.detail) : '')}
                  onChange={e => setEditFields(f => ({ ...f, detail: e.target.value }))}
                  rows={2}
                />
              ) : (
                <p className="text-gray-800 leading-relaxed text-xs bg-blue-50 p-2 rounded">{workorder.detail}</p>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">หมายเหตุ</label>
              {editMode ? (
                <textarea
                  className="text-sm text-gray-800 bg-yellow-50 p-2 rounded w-full"
                  value={typeof editFields.note === 'string' ? editFields.note : (editFields.note ? String(editFields.note) : '')}
                  onChange={e => setEditFields(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                />
              ) : (
                <p className="text-gray-800 leading-relaxed text-xs bg-yellow-50 p-2 rounded">{workorder.note}</p>
              )}
            </div>
          </div>
      </div>

        {/* ข้อมูลลูกค้า */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">ข้อมูลลูกค้า</h2>
          <div className="space-y-2">
            <div>
              <label className="block font-medium text-gray-600 mb-1">ชื่อลูกค้า</label>
              {editMode ? (
                <input
                  type="text"
                  className="text-sm font-semibold text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.name === 'string' ? editFields.name : (editFields.name ? String(editFields.name) : '')}
                  onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
                />
              ) : (
                <div className="text-base font-semibold text-gray-800 bg-gray-50 p-2 rounded">{safe(workorder.name)}</div>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">เบอร์โทรศัพท์</label>
              {editMode ? (
                <input
                  type="text"
                  className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.contact === 'string' ? editFields.contact : (editFields.contact ? String(editFields.contact) : '')}
                  onChange={e => setEditFields(f => ({ ...f, contact: e.target.value }))}
                />
              ) : (
                <div className="text-base font-medium text-gray-800 bg-gray-50 p-2 rounded">
                  <a href={`tel:${workorder.contact}`} className="text-blue-600 hover:underline">{safe(workorder.contact)}</a>
                </div>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">หมู่บ้าน</label>
              {editMode ? (
                <input
                  type="text"
                  className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.village === 'string' ? editFields.village : (editFields.village ? String(editFields.village) : '')}
                  onChange={e => setEditFields(f => ({ ...f, village: e.target.value }))}
                />
              ) : (
                <div className="text-base font-medium text-gray-800 bg-gray-50 p-2 rounded">{safe(workorder.village)}</div>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">ที่อยู่</label>
              {editMode ? (
                <textarea
                  className="text-sm text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.address === 'string' ? editFields.address : (editFields.address ? String(editFields.address) : '')}
                  onChange={e => setEditFields(f => ({ ...f, address: e.target.value }))}
                  rows={2}
                />
              ) : (
                workorder.address && (
                  <div className="text-gray-800 bg-gray-50 p-2 rounded leading-relaxed text-xs">{workorder.address}</div>
                )
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">แผนที่</label>
              {editMode ? (
                <input
                  type="text"
                  className="text-sm text-gray-800 bg-gray-50 p-2 rounded w-full"
                  value={typeof editFields.mapLink === 'string' ? editFields.mapLink : (editFields.mapLink ? String(editFields.mapLink) : '')}
                  onChange={e => setEditFields(f => ({ ...f, mapLink: e.target.value }))}
                />
              ) : (
                workorder.mapLink && (
                  <div className="bg-gray-50 p-2 rounded">
                    <a href={workorder.mapLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">เปิดดูแผนที่</a>
                  </div>
                )
              )}
            </div>
            
          </div>
        </div>

        {/* การดำเนินงาน */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">การดำเนินงาน</h2>
          <div className="space-y-2">
            {/* Timeline */}
            <div className="mb-4">
              <label className="block font-medium text-gray-600 mb-2">สถานะการดำเนินงาน</label>
              <ol className="relative border-l-2 border-gray-300 ml-3">
                {[
                  { key: 'อยู่ในแผนงาน', color: 'bg-blue-500', status: 'อยู่ในแผนงาน' },
                  { key: 'ช่างกำลังดำเนินการ', color: 'bg-yellow-500', status: 'ช่างกำลังดำเนินการ' },
                  { key: 'เสร็จสิ้น', color: 'bg-green-500', status: 'เสร็จสิ้น' }
                ].map((step, idx) => {
                  const statusMap = {
                    'อยู่ในแผนงาน': 0,
                    'ช่างกำลังดำเนินการ': 1,
                    'เสร็จสิ้น': 2
                  };
                  const currentIdx = statusMap[workorder.processStatus] !== undefined
                    ? statusMap[workorder.processStatus]
                    : -1;
                  const isActive = idx === currentIdx;
                  const isCompleted = idx < currentIdx;
                  return (
                    <li key={step.key} className="mb-6 ml-4">
                      <div className="flex items-center">
                        <span
                          className={`flex items-center justify-center w-5 h-5 rounded-full border-2
                            ${isCompleted ? step.color + ' border-transparent' : isActive ? 'border-blue-500 bg-white' : 'border-gray-300 bg-white'}
                          `}
                        >
                          {isCompleted && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={`ml-3 text-xs font-medium ${isActive ? 'text-blue-700 font-semibold' : isCompleted ? 'text-green-700' : 'text-gray-500'}`}>{step.key}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
            
            <div>
              <label className="block font-medium text-gray-600 mb-1">ราคา</label>
              {editMode ? (
                <input
                  type="number"
                  className="text-sm font-semibold text-pink-600 bg-pink-50 p-2 rounded w-full"
                  value={editFields.price !== undefined && editFields.price !== null ? String(editFields.price) : ''}
                  onChange={e => setEditFields(f => ({ ...f, price: e.target.value }))}
                  min={0}
                />
              ) : (
                <div className="text-sm font-semibold text-pink-600 bg-pink-50 p-2 rounded">{safe(workorder.price, 'ยังไม่ระบุ')} บาท</div>
              )}
            </div>
            
            <div>
              <label className="block font-medium text-gray-600 mb-1">สถานะเก็บเงิน</label>
              {editMode ? (
                <select
                  className="text-sm font-medium bg-gray-50 p-2 rounded w-full"
                  value={editFields.paymentStatus || ''}
                  onChange={e => setEditFields(f => ({ ...f, paymentStatus: e.target.value }))}
                >
                  <option value="">เลือกสถานะ</option>
                  <option value="ส่งงานเรียบร้อยแล้ว">ส่งงานเรียบร้อยแล้ว</option>
                  <option value="เก็บเงินได้แล้ว">เก็บเงินได้แล้ว</option>
                  <option value="ติดตามทวงหนี้ ครั้งที่ 1">ติดตามทวงหนี้ ครั้งที่ 1</option>
                  <option value="ติดตามทวงหนี้ ครั้งที่ 2">ติดตามทวงหนี้ ครั้งที่ 2</option>
                  <option value="ติดตามทวงหนี้ ครั้งที่ 3">ติดตามทวงหนี้ ครั้งที่ 3</option>
                </select>
              ) : (
                <div className={`text-sm font-medium p-2 rounded ${
                  workorder.paymentStatus === 'เก็บเงินได้แล้ว' ? 'bg-green-100 text-green-800' :
                  workorder.paymentStatus === 'ส่งงานเรียบร้อยแล้ว' ? 'bg-blue-100 text-blue-800' :
                  workorder.paymentStatus?.includes('ติดตามทวงหนี้') ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {safe(workorder.paymentStatus, 'ยังไม่ระบุ')}
                </div>
              )}
            </div>
            
            {workorder.adminNote && (
              <div>
                <label className="block font-medium text-gray-600 mb-1">หมายเหตุผู้ดูแลระบบ</label>
                <p className="text-gray-800 leading-relaxed text-xs bg-orange-50 border-l-4 border-orange-400 p-2 rounded">{workorder.adminNote}</p>
              </div>
            )}
          </div>
        </div>

        {/* ข้อมูลบริการ */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">ข้อมูลบริการ</h2>
          <div className="space-y-2">
            <div>
              <label className="block font-medium text-gray-600 mb-1">เคสที่</label>
              {editMode ? (
                <input
                  type="text"
                  className="w-full text-center bg-indigo-100 text-indigo-800 rounded px-2 py-1 text-sm font-bold"
                  value={typeof editFields.caseNumber === 'string' ? editFields.caseNumber : (editFields.caseNumber ? String(editFields.caseNumber) : '')}
                  onChange={e => setEditFields(f => ({ ...f, caseNumber: e.target.value }))}
                />
              ) : (
                <div className="w-10 h-10 bg-indigo-100 text-indigo-800 rounded-full text-sm font-bold flex items-center justify-center">{safe(workorder.caseNumber, '?')}</div>
              )}
            </div>
            <div>
              <label className="block font-medium text-gray-600 mb-1">ช่างรับผิดชอบ</label>
              {editMode ? (
                <input
                  type="text"
                  className="text-sm font-semibold text-indigo-600 bg-indigo-50 p-2 rounded w-full"
                  value={typeof editFields.beauticianName === 'string' ? editFields.beauticianName : (editFields.beauticianName ? String(editFields.beauticianName) : '')}
                  onChange={e => setEditFields(f => ({ ...f, beauticianName: e.target.value }))}
                />
              ) : (
                <div className="text-sm font-semibold text-indigo-600 bg-indigo-50 p-2 rounded">{safe(workorder.beauticianName || workorder.responsible)}</div>
              )}
            </div>
            {workorder.bookingId && (
              <div>
                <label className="block font-medium text-gray-600 mb-1">รหัสการจอง</label>
                <div className="text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded break-all">{workorder.bookingId}</div>
              </div>
            )}
            {workorder.createdAt && (
              <div>
                <label className="block font-medium text-gray-600 mb-1">สร้างเมื่อ</label>
                <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded">{new Date(workorder.createdAt).toLocaleString('th-TH')}</div>
              </div>
            )}
            {workorder.updatedAt && (
              <div>
                <label className="block font-medium text-gray-600 mb-1">อัปเดตล่าสุด</label>
                <div className="text-xs text-gray-800 bg-gray-50 p-2 rounded">{new Date(workorder.updatedAt).toLocaleString('th-TH')}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}