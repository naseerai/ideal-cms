"""Students router."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, Response
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import uuid
import csv
import io
import base64
import logging
from openpyxl import Workbook

from db import db
from models import *
from services.whatsapp import *
from services.pdf import *

router = APIRouter()
logger = logging.getLogger(__name__)


from fastapi.responses import StreamingResponse, Response
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import uuid
import csv
import io
import base64
import logging
from openpyxl import Workbook

from db import db
from models import *
from services.whatsapp import *
from services.pdf import *

router = APIRouter()
logger = logging.getLogger(__name__)

# ==================== STUDENT ROUTES ====================

@router.post("/students", response_model=Student)
async def create_student(student: StudentCreate):
    existing = await db.students.find_one({"studentCode": student.studentCode}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Student ID already exists")
    student_obj = Student(**student.model_dump())
    doc = student_obj.model_dump()
    doc['createdAt'] = doc['createdAt'].isoformat()
    await db.students.insert_one(doc)
    return student_obj

@router.post("/students/bulk")
async def bulk_upload_students(file: UploadFile = File(...)):
    try:
        content = await file.read()
        decoded = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))
        added, errors = 0, []
        for row in csv_reader:
            try:
                student_data = StudentCreate(
                    studentCode=row['Student ID'].strip(),
                    studentName=row['Student Name'].strip(), rollNo=row['Roll No'].strip(),
                    studentYear=row['Year'].strip(), studentClass=row['Class'].strip(), section=row['Section'].strip(),
                    fatherName=row['Father Name'].strip(), motherName=row['Mother Name'].strip(),
                    mobile=row['Mobile Number'].strip(), address=row['Address'].strip(),
                    feeTerm1=float(row['Fee Term1']), feeTerm2=float(row['Fee Term2']), feeTerm3=float(row['Fee Term3']),
                    parentUsername=row.get('Parent Username', '').strip() or None,
                    parentPassword=row.get('Parent Password', '').strip() or None,
                )
                existing = await db.students.find_one({"studentCode": student_data.studentCode}, {"_id": 0})
                if existing:
                    errors.append(f"Student ID {student_data.studentCode} exists")
                    continue
                student_obj = Student(**student_data.model_dump())
                doc = student_obj.model_dump()
                doc['createdAt'] = doc['createdAt'].isoformat()
                await db.students.insert_one(doc)
                added += 1
            except Exception as e:
                errors.append(f"Row error: {str(e)}")
        return {"added": added, "errors": errors}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/students/sample-csv")
async def download_sample_csv():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Student ID', 'Student Name', 'Roll No', 'Year', 'Class', 'Section', 'Father Name', 'Mother Name', 'Mobile Number', 'Address', 'Fee Term1', 'Fee Term2', 'Fee Term3', 'Parent Username', 'Parent Password'])
    writer.writerow(['ADM001', 'John Doe', '1', '2024-2027', 'B.Sc Honours', 'A', 'Robert Doe', 'Jane Doe', '9876543210', '123 Main St', '5000', '5000', '5000', 'parent101', 'pass101'])
    writer.writerow(['ADM002', 'Alice Smith', '2', '2024-2027', 'B.Sc Honours', 'A', 'Michael Smith', 'Sarah Smith', '9876543211', '456 Oak Ave', '5000', '5000', '5000', 'parent102', 'pass102'])
    output.seek(0)
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=sample_students.csv"})

@router.get("/students")
async def get_students(studentYear: Optional[str] = None, studentClass: Optional[str] = None, section: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 50):
    query = {}
    if studentYear: query['studentYear'] = studentYear
    if studentClass: query['studentClass'] = studentClass
    if section: query['section'] = section
    if search: query['$or'] = [{'studentName': {'$regex': search, '$options': 'i'}}, {'rollNo': {'$regex': search, '$options': 'i'}}, {'studentCode': {'$regex': search, '$options': 'i'}}]
    total = await db.students.count_documents(query)
    skip = (page - 1) * limit
    students = await db.students.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    for s in students:
        if isinstance(s.get('createdAt'), str): s['createdAt'] = datetime.fromisoformat(s['createdAt'])
        if 'studentCode' not in s: s['studentCode'] = s.get('rollNo', '')
    return {"students": students, "total": total, "page": page, "limit": limit, "totalPages": max(1, -(-total // limit))}

@router.put("/students/{student_id}", response_model=Student)
async def update_student(student_id: str, update_data: StudentUpdate):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict: await db.students.update_one({"id": student_id}, {"$set": update_dict})
    updated = await db.students.find_one({"id": student_id}, {"_id": 0})
    if isinstance(updated.get('createdAt'), str): updated['createdAt'] = datetime.fromisoformat(updated['createdAt'])
    return Student(**updated)

@router.delete("/students/{student_id}")
async def delete_student(student_id: str):
    result = await db.students.delete_one({"id": student_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted"}

@router.post("/students/promote-preview")
async def promote_students_preview(request: PromoteRequest):
    """Compute new fee structure for all students in fromClass without committing."""
    query = {"studentClass": request.fromClass}
    if request.studentYear: query['studentYear'] = request.studentYear
    students = await db.students.find(query, {"_id": 0}).to_list(10000)
    if not students:
        raise HTTPException(status_code=404, detail="No students found")

    preview = []
    for student in students:
        active_payments = await db.fee_payments.find(
            {"studentId": student['id'], "status": {"$nin": ["reverted", "archived"]}}, {"_id": 0}
        ).to_list(1000)
        total_paid = sum(p.get('amount', 0) for p in active_payments)
        old_custom_fees = await db.fee_types.find({
            "$or": [
                {"applicableClass": request.fromClass, "applicableSection": student.get('section', '')},
                {"applicableClass": request.fromClass, "applicableSection": {"$in": [None, ""]}},
                {"applicableClass": {"$in": [None, ""]}, "applicableSection": {"$in": [None, ""]}},
            ]
        }, {"_id": 0}).to_list(500)
        total_custom = sum(cf.get('amount', 0) for cf in old_custom_fees)
        old_t1 = student.get('feeTerm1', 0)
        old_t2 = student.get('feeTerm2', 0)
        old_t3 = student.get('feeTerm3', 0)
        total_expected = old_t1 + old_t2 + old_t3 + total_custom
        total_due = max(0, total_expected - total_paid)
        new_t1 = old_t1 + total_due
        new_t2 = old_t2
        new_t3 = old_t3 + 5000
        preview.append({
            "studentId": student['id'],
            "studentCode": student.get('studentCode', ''),
            "studentName": student.get('studentName', ''),
            "rollNo": student.get('rollNo', ''),
            "section": student.get('section', ''),
            "totalPaid": total_paid,
            "totalExpected": total_expected,
            "totalDue": total_due,
            "oldFees": {"term1": old_t1, "term2": old_t2, "term3": old_t3, "customFeesTotal": total_custom},
            "newFees": {"term1": new_t1, "term2": new_t2, "term3": new_t3},
        })
    return {"fromClass": request.fromClass, "toClass": request.toClass, "studentCount": len(preview), "preview": preview}

@router.post("/students/promote")
async def promote_students(request: PromoteRequest):
    query = {"studentClass": request.fromClass}
    if request.studentYear: query['studentYear'] = request.studentYear
    students = await db.students.find(query, {"_id": 0}).to_list(10000)
    if not students:
        raise HTTPException(status_code=404, detail="No students found")
    
    promoted_count = 0
    for student in students:
        await _promote_one_student(student, request.toClass)
        promoted_count += 1
    
    return {"message": f"Promoted {promoted_count} students from {request.fromClass} to {request.toClass}. Previous year due added to Term 1, Term 3 increased by Rs.5000."}


class SingleStudentPromote(BaseModel):
    toClass: str

async def _calc_promotion(student: Dict):
    """Shared calc logic. Returns dict with totals + new fees."""
    from_class = student.get('studentClass', '')
    active_payments = await db.fee_payments.find(
        {"studentId": student['id'], "status": {"$nin": ["reverted", "archived"]}}, {"_id": 0}
    ).to_list(1000)
    total_paid = sum(p.get('amount', 0) for p in active_payments)
    old_custom_fees = await db.fee_types.find({
        "$or": [
            {"applicableClass": from_class, "applicableSection": student.get('section', '')},
            {"applicableClass": from_class, "applicableSection": {"$in": [None, ""]}},
            {"applicableClass": {"$in": [None, ""]}, "applicableSection": {"$in": [None, ""]}},
        ]
    }, {"_id": 0}).to_list(500)
    total_custom = sum(cf.get('amount', 0) for cf in old_custom_fees)
    old_t1 = student.get('feeTerm1', 0)
    old_t2 = student.get('feeTerm2', 0)
    old_t3 = student.get('feeTerm3', 0)
    total_expected = old_t1 + old_t2 + old_t3 + total_custom
    total_due = max(0, total_expected - total_paid)
    return {
        "fromClass": from_class,
        "totalPaid": total_paid, "totalExpected": total_expected, "totalDue": total_due,
        "oldFees": {"term1": old_t1, "term2": old_t2, "term3": old_t3, "customFeesTotal": total_custom},
        "newFees": {"term1": old_t1 + total_due, "term2": old_t2, "term3": old_t3 + 5000},
    }

async def _promote_one_student(student: Dict, to_class: str):
    """Promotes a single student using current fee carryover rules. Appends to promotionHistory."""
    calc = await _calc_promotion(student)
    history_entry = {
        "fromClass": calc['fromClass'],
        "toClass": to_class,
        "totalDue": calc['totalDue'],
        "totalPaid": calc['totalPaid'],
        "oldFees": calc['oldFees'],
        "newFees": calc['newFees'],
        "promotedOn": datetime.now(timezone.utc).isoformat(),
    }
    # Build the update
    set_doc = {
        "studentClass": to_class,
        "feeTerm1": calc['newFees']['term1'],
        "feeTerm2": calc['newFees']['term2'],
        "feeTerm3": calc['newFees']['term3'],
        "previousYearDues": {
            "amount": calc['totalDue'],
            "fromClass": calc['fromClass'],
            "promotedOn": history_entry['promotedOn']
        },
        "academicYear": str(datetime.now().year),
    }
    await db.students.update_one(
        {"id": student['id']},
        {"$set": set_doc, "$push": {"promotionHistory": history_entry}}
    )
    # Archive existing payments
    await db.fee_payments.update_many(
        {"studentId": student['id'], "status": {"$nin": ["reverted", "archived"]}},
        {"$set": {"status": "archived"}}
    )

@router.post("/students/{student_id}/promote-preview")
async def promote_single_preview(student_id: str, data: SingleStudentPromote):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    calc = await _calc_promotion(student)
    return {
        "studentId": student['id'],
        "studentCode": student.get('studentCode', ''),
        "studentName": student.get('studentName', ''),
        "rollNo": student.get('rollNo', ''),
        "section": student.get('section', ''),
        "fromClass": calc['fromClass'],
        "toClass": data.toClass,
        "totalPaid": calc['totalPaid'],
        "totalExpected": calc['totalExpected'],
        "totalDue": calc['totalDue'],
        "oldFees": calc['oldFees'],
        "newFees": calc['newFees'],
    }

@router.post("/students/{student_id}/promote")
async def promote_single_student(student_id: str, data: SingleStudentPromote):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    await _promote_one_student(student, data.toClass)
    return {"message": f"{student.get('studentName')} promoted to class {data.toClass}."}

class BulkDeleteRequest(BaseModel):
    studentIds: List[str]

@router.post("/students/bulk-delete")
async def bulk_delete_students(data: BulkDeleteRequest):
    if not data.studentIds:
        raise HTTPException(status_code=400, detail="No students selected")
    result = await db.students.delete_many({"id": {"$in": data.studentIds}})
    return {"message": f"Deleted {result.deleted_count} students"}

