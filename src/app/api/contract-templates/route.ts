import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// ─── Default templates (seeded on first GET if empty) ───
const DEFAULT_TEMPLATES = [
  {
    name: "عقد حارس السباحة",
    code: "guard",
    description: "عقد عمل لحارس السباحة (Lifeguard / Maître-nageur)",
    defaultDuration: 365,
    content: `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;line-height:1.8;padding:20px;">
<h2 style="text-align:center;color:#0f766e;margin-bottom:20px;">عقد عمل — حارس سباحة</h2>

<p>إنه في اليوم {{today}}، بين ممثلي {{club_name}} - {{club_branch}}، تم الاتفاق على ما يلي:</p>

<h3 style="color:#0f766e;">المادة 1: الأطراف</h3>
<p><strong>العمال:</strong> السيد/ة {{worker_name}}، المولود/ة بتاريخ {{birth_date}} بمكان {{birth_place}}، الساكن/ة في {{address}}، صاحب/ة بطاقة التعريف رقم {{national_id}}، الهاتف {{phone}}.</p>

<h3 style="color:#0f766e;">المادة 2: المنصب</h3>
<p>يعين العامل في منصب: <strong>{{position}}</strong>.</p>

<h3 style="color:#0f766e;">المادة 3: المدة</h3>
<p>تبدأ مدة هذا العقد في {{start_date}} وتنتهي في {{end_date}}.</p>

<h3 style="color:#0f766e;">المادة 4: الأجر</h3>
<p>يحدد أجر العامل بسعر {{hour_rate}} دج للساعة، مع جدول عمل: {{work_schedule}}.</p>

<h3 style="color:#0f766e;">المادة 5: الالتزامات</h3>
<p>يلتزم العامل بأداء مهامه بكل جدية وإتقان، والمحافظة على سلامة المنخرطين، ومراقبة المكاتب والمعدات.</p>

<h3 style="color:#0f766e;">المادة 6: رقم العقد</h3>
<p>رقم هذا العقد: <strong>{{contract_number}}</strong>.</p>

<div style="margin-top:60px;display:flex;justify-content:space-between;">
  <div style="text-align:center;"><p>إمضاء العامل</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الجمعية</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الفرع</p><br/><br/>_____________</div>
</div>
</div>`,
  },
  {
    name: "عقد مدرب",
    code: "coach",
    description: "عقد عمل لمدرب السباحة",
    defaultDuration: 365,
    content: `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;line-height:1.8;padding:20px;">
<h2 style="text-align:center;color:#0f766e;margin-bottom:20px;">عقد عمل — مدرب سباحة</h2>

<p>إنه في اليوم {{today}}، بين ممثلي {{club_name}} - {{club_branch}}، تم الاتفاق على ما يلي:</p>

<h3 style="color:#0f766e;">المادة 1: الأطراف</h3>
<p><strong>المدرب:</strong> السيد/ة {{worker_name}}، المولود/ة بتاريخ {{birth_date}} في {{birth_place}}، الساكن/ة في {{address}}، الهاتف {{phone}}.</p>

<h3 style="color:#0f766e;">المادة 2: المنصب</h3>
<p>يعين في منصب: <strong>مدرب سباحة</strong> ({{position}}).</p>

<h3 style="color:#0f766e;">المادة 3: المدة</h3>
<p>من {{start_date}} إلى {{end_date}}.</p>

<h3 style="color:#0f766e;">المادة 4: الأجر</h3>
<p>{{hour_rate}} دج/ساعة.</p>

<h3 style="color:#0f766e;">المادة 5: المهام</h3>
<p>تدريب المنخرطين، إعداد برامج التدريب، المشاركة في المسابقات، ضمان السلامة.</p>

<h3 style="color:#0f766e;">المادة 6: رقم العقد</h3>
<p>{{contract_number}}</p>

<div style="margin-top:60px;display:flex;justify-content:space-between;">
  <div style="text-align:center;"><p>إمضاء المدرب</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الجمعية</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الفرع</p><br/><br/>_____________</div>
</div>
</div>`,
  },
  {
    name: "عقد إداري",
    code: "admin",
    description: "عقد عمل لموظف إداري",
    defaultDuration: 365,
    content: `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;line-height:1.8;padding:20px;">
<h2 style="text-align:center;color:#0f766e;margin-bottom:20px;">عقد عمل — إداري</h2>

<p>إنه في اليوم {{today}}، بين ممثلي {{club_name}} - {{club_branch}}، تم الاتفاق على ما يلي:</p>

<h3 style="color:#0f766e;">المادة 1: الأطراف</h3>
<p><strong>العامل:</strong> {{worker_name}}، المولود: {{birth_date}} في {{birth_place}}، العنوان: {{address}}، الهاتف: {{phone}}.</p>

<h3 style="color:#0f766e;">المادة 2: المنصب</h3>
<p>منصب: <strong>{{position}}</strong>.</p>

<h3 style="color:#0f766e;">المادة 3: المدة</h3>
<p>من {{start_date}} إلى {{end_date}}.</p>

<h3 style="color:#0f766e;">المادة 4: الأجر</h3>
<p>{{hour_rate}} دج/ساعة. الجدول: {{work_schedule}}.</p>

<h3 style="color:#0f766e;">المادة 5: المهام</h3>
<p>إدارة الشؤون الإدارية، تنظيم الملفات، استقبال المنخرطين، إعداد التقارير.</p>

<h3 style="color:#0f766e;">المادة 6: رقم العقد</h3>
<p>{{contract_number}}</p>

<div style="margin-top:60px;display:flex;justify-content:space-between;">
  <div style="text-align:center;"><p>إمضاء العامل</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الجمعية</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الفرع</p><br/><br/>_____________</div>
</div>
</div>`,
  },
  {
    name: "عقد عامل صيانة",
    code: "maintenance",
    description: "عقد عمل لعامل صيانة",
    defaultDuration: 365,
    content: `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;line-height:1.8;padding:20px;">
<h2 style="text-align:center;color:#0f766e;margin-bottom:20px;">عقد عمل — عامل صيانة</h2>
<p>في اليوم {{today}}، بين {{club_name}} - {{club_branch}} والسيد/ة {{worker_name}}، المولود {{birth_date}} في {{birth_place}}، الساكن في {{address}}، الهاتف {{phone}}.</p>
<h3 style="color:#0f766e;">المنصب</h3><p>{{position}}</p>
<h3 style="color:#0f766e;">المدة</h3><p>من {{start_date}} إلى {{end_date}}</p>
<h3 style="color:#0f766e;">الأجر</h3><p>{{hour_rate}} دج/ساعة</p>
<h3 style="color:#0f766e;">المهام</h3><p>صيانة المسبح، المعدات، النظافة العامة للمنشأة.</p>
<h3 style="color:#0f766e;">رقم العقد</h3><p>{{contract_number}}</p>
<div style="margin-top:60px;display:flex;justify-content:space-between;">
  <div style="text-align:center;"><p>إمضاء العامل</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الجمعية</p><br/><br/>_____________</div>
</div>
</div>`,
  },
  {
    name: "عقد منظفة",
    code: "cleaner",
    description: "عقد عمل لمنظفة",
    defaultDuration: 365,
    content: `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;line-height:1.8;padding:20px;">
<h2 style="text-align:center;color:#0f766e;margin-bottom:20px;">عقد عمل — منظفة</h2>
<p>في اليوم {{today}}، بين {{club_name}} - {{club_branch}} والسيد/ة {{worker_name}}، المولود {{birth_date}} في {{birth_place}}، الساكن في {{address}}، الهاتف {{phone}}.</p>
<h3 style="color:#0f766e;">المنصب</h3><p>{{position}}</p>
<h3 style="color:#0f766e;">المدة</h3><p>من {{start_date}} إلى {{end_date}}</p>
<h3 style="color:#0f766e;">الأجر</h3><p>{{hour_rate}} دج/ساعة</p>
<h3 style="color:#0f766e;">المهام</h3><p>النظافة اليومية للمسبح، الغرف، المرافق الصحية.</p>
<h3 style="color:#0f766e;">رقم العقد</h3><p>{{contract_number}}</p>
<div style="margin-top:60px;display:flex;justify-content:space-between;">
  <div style="text-align:center;"><p>إمضاء العامل</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الجمعية</p><br/><br/>_____________</div>
</div>
</div>`,
  },
  {
    name: "عقد موسمي",
    code: "seasonal",
    description: "عقد عمل موسمي (صيفي)",
    defaultDuration: 90,
    content: `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;line-height:1.8;padding:20px;">
<h2 style="text-align:center;color:#0f766e;margin-bottom:20px;">عقد عمل موسمي</h2>
<p>في اليوم {{today}}، بين {{club_name}} - {{club_branch}} والسيد/ة {{worker_name}}، المولود {{birth_date}} في {{birth_place}}، الساكن في {{address}}، الهاتف {{phone}}.</p>
<h3 style="color:#0f766e;">المنصب</h3><p>{{position}}</p>
<h3 style="color:#0f766e;">المدة الموسمية</h3><p>من {{start_date}} إلى {{end_date}}</p>
<h3 style="color:#0f766e;">الأجر</h3><p>{{hour_rate}} دج/ساعة — جدول: {{work_schedule}}</p>
<h3 style="color:#0f766e;">رقم العقد</h3><p>{{contract_number}}</p>
<div style="margin-top:60px;display:flex;justify-content:space-between;">
  <div style="text-align:center;"><p>إمضاء العامل</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الجمعية</p><br/><br/>_____________</div>
  <div style="text-align:center;"><p>رئيس الفرع</p><br/><br/>_____________</div>
</div>
</div>`,
  },
];

// ─── GET: list templates (auto-seed defaults if empty) ───
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    // Seed defaults if none exist
    const existing = await db.contractTemplate.count({ where: { clubId: user.clubId } });
    if (existing === 0) {
      await db.contractTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({ ...t, clubId: user.clubId! })),
      });
    }

    const templates = await db.contractTemplate.findMany({
      where: { clubId: user.clubId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ templates });
  } catch (e) {
    console.error("GET contract-templates:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// ─── POST: create new template ───
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const body = await req.json();
    const template = await db.contractTemplate.create({
      data: {
        ...body,
        clubId: user.clubId!,
      },
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    console.error("POST contract-templates:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
