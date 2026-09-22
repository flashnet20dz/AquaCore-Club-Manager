/**
 * Variable substitution engine for employment contracts.
 *
 * Available variables:
 *   {{club_name}}            — اسم النادي (من الإعدادات)
 *   {{club_branch}}          — اسم الفرع
 *   {{worker_name}}          — اسم العامل الكامل
 *   {{birth_date}}           — تاريخ الميلاد
 *   {{birth_place}}          — مكان الميلاد
 *   {{address}}              — العنوان
 *   {{phone}}                — الهاتف
 *   {{national_id}}          — رقم بطاقة التعريف
 *   {{position}}             — المنصب
 *   {{contract_number}}      — رقم العقد
 *   {{start_date}}           — تاريخ بداية العقد
 *   {{end_date}}             — تاريخ نهاية العقد
 *   {{hour_rate}}            — سعر الساعة
 *   {{work_schedule}}        — جدول العمل
 *   {{club_president}}       — رئيس النادي
 *   {{association_president}}— رئيس الجمعية
 *   {{today}}                — تاريخ اليوم
 */

export interface ContractVariables {
  club_name?: string;
  club_branch?: string;
  club_address?: string;
  worker_name?: string;
  birth_date?: string;
  birth_place?: string;
  address?: string;
  phone?: string;
  national_id?: string;
  position?: string;
  contract_number?: string;
  year?: string | number;
  start_date?: string;
  end_date?: string;
  hour_rate?: string | number;
  monthly_salary?: string | number;
  wage_clause?: string;
  work_schedule?: string;
  workplace?: string;
  first_party_rep?: string;
  first_party_role?: string;
  club_president?: string;
  association_president?: string;
  association_president_role?: string;
  city?: string;
  contract_date?: string;
  today?: string;
}

export function substituteVariables(template: string, vars: ContractVariables): string {
  const mergedVars: ContractVariables = {
    wage_clause: "يتقاضى الطرف الثاني أجرًا يُحسب على أساس الحجم الساعي كل شهر.",
    ...vars,
  };
  if (mergedVars.club_name) {
    let clean = mergedVars.club_name.trim();
    clean = clean.replace(/^(الجمعية\s+الرياضية\s+الهاوية\s+)+/g, "الجمعية الرياضية الهاوية ");
    mergedVars.club_name = clean;
  }
  let result = template;
  for (const [key, value] of Object.entries(mergedVars)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(placeholder, String(value ?? "—"));
  }
  return result;
}

export function formatDateYMD(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export const AVAILABLE_VARIABLES = [
  { key: "contract_number", label: "رقم العقد", description: "رقم العقد الرسمي e.g. 01 / ن.ر.ر.س. 2026" },
  { key: "club_name", label: "اسم النادي / الجمعية", description: "الجمعية الرياضية الهاوية النادي الرياضي..." },
  { key: "club_branch", label: "اسم الفرع", description: "فرع السباحة" },
  { key: "club_address", label: "مقر النادي", description: "مقر النادي (طاب لحسن)" },
  { key: "first_party_rep", label: "ممثل الطرف الأول", description: "اسم ممثل صاحب العمل (رئيس الفرع)" },
  { key: "first_party_role", label: "صفة ممثل الطرف الأول", description: "رئيس فرع السباحة" },
  { key: "worker_name", label: "اسم العامل (الطرف الثاني)", description: "الاسم واللقب للعامل" },
  { key: "birth_date", label: "تاريخ الميلاد", description: "تاريخ ميلاد العامل" },
  { key: "birth_place", label: "مكان الميلاد", description: "مكان ميلاد العامل" },
  { key: "address", label: "العنوان", description: "عنوان إقامة العامل" },
  { key: "phone", label: "الهاتف", description: "رقم هاتف العامل" },
  { key: "national_id", label: "رقم بطاقة التعريف", description: "رقم بطاقة التعريف الوطنية" },
  { key: "position", label: "المنصب / المهنة", description: "حارس سباحة (منقذ مائي)" },
  { key: "start_date", label: "تاريخ بداية العقد", description: "تاريخ سريان العقد" },
  { key: "end_date", label: "تاريخ نهاية العقد", description: "تاريخ انتهاء العقد" },
  { key: "workplace", label: "مكان العمل", description: "المسبح النصف الأولمبي طاب لحسن" },
  { key: "work_schedule", label: "جدول العمل", description: "جدول الحصص أو 40 ساعة/أسبوع" },
  { key: "hour_rate", label: "سعر الساعة", description: "الأجر بالساعة" },
  { key: "wage_clause", label: "بند الأجر", description: "صيغة الأجر الساعي أو الشهري كاملة" },
  { key: "city", label: "مدينة التحرير", description: "سعيدة" },
  { key: "contract_date", label: "تاريخ التحرير", description: "تاريخ توقيع العقد" },
  { key: "association_president", label: "رئيس الجمعية", description: "اسم رئيس الجمعية الرياضية الهاوية" },
  { key: "association_president_role", label: "صفة رئيس الجمعية", description: "رئيس الجمعية الرياضية الهاوية" },
  { key: "today", label: "تاريخ اليوم", description: "تاريخ اليوم الحالي" },
];

/** القالب الإداري المعتمد لعقد عمل محدد المدة (CDD) - مصمم ليكون في صفحتين (2) متوازنتين بدقة */
export const OFFICIAL_CDD_TEMPLATE_HTML = `<div class="contract-document" style="font-family:'Cairo','Tajawal',Tahoma,Arial,sans-serif;color:#0f172a;line-height:1.55;font-size:11.5px;direction:rtl;text-align:right;">

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- 📄 الصفحة الأولى: الديباجة الرسمية + المواد 01 إلى 08                   -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <div class="contract-page contract-page-1" style="page-break-after:always;break-after:page;">
    
    <!-- ديباجة الأطراف الرسمية -->
    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;margin:8px 0 6px 0;">
      <p style="font-weight:800;font-size:12px;margin:0 0 5px 0;color:#0f766e;">بين الموقعين أدناه:</p>
      
      <!-- الطرف الأول -->
      <div style="margin-bottom:6px;padding-right:8px;border-right:3px solid #0f766e;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0f172a;font-size:11.5px;">الطرف الأول (صاحب العمل):</p>
        <p style="margin:0;line-height:1.6;font-size:11.5px;color:#0f172a;">
          <strong>{{club_name}}</strong>، 
          الكائن مقرها بـ: <strong>{{club_address}}</strong>، 
          ويمثلها في هذا العقد السيد: <strong>{{first_party_rep}}</strong> بصفته <strong>{{first_party_role}}</strong>.
          <span style="color:#64748b;font-size:11px;"> (ويشار إليه في هذا العقد بـ "الطرف الأول").</span>
        </p>
      </div>

      <!-- الطرف الثاني -->
      <div style="padding-right:8px;border-right:3px solid #0284c7;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0f172a;font-size:11.5px;">الطرف الثاني (العامل):</p>
        <p style="margin:0;line-height:1.6;font-size:11.5px;color:#0f172a;">
          الاسم واللقب: <strong>{{worker_name}}</strong>. 
          تاريخ ومكان الميلاد: <strong>{{birth_date}}</strong> بـ <strong>{{birth_place}}</strong> — العنوان: <strong>{{address}}</strong>.
          <br/>
          رقم بطاقة التعريف الوطنية: <strong>{{national_id}}</strong> | رقم الهاتف: <strong>{{phone}}</strong>.
          <span style="color:#64748b;font-size:11px;"> (ويشار إليه في هذا العقد بـ "الطرف الثاني").</span>
        </p>
      </div>
    </div>

    <!-- المواد القانونية 01 إلى 08 -->
    <!-- المادة 01 -->
    <div style="margin-bottom:5px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 01: موضوع العقد
      </div>
      <div style="padding:5px 10px;font-size:11.5px;line-height:1.6;color:#0f172a;">
        يوظف الطرف الأول الطرف الثاني بصفة <strong>{{position}}</strong> للعمل بالمسبح، قصد ضمان أمن وسلامة السباحين، ومراقبة النشاطات المائية، والتدخل عند الضرورة، طبقًا للتشريع المعمول به.
      </div>
    </div>

    <!-- المادة 02 -->
    <div style="margin-bottom:5px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 02: مدة العقد
      </div>
      <div style="padding:5px 10px;font-size:11.5px;line-height:1.6;color:#0f172a;">
        يبرم هذا العقد لمدة محددة ابتداءً من: <strong>{{start_date}}</strong> إلى غاية: <strong>{{end_date}}</strong> وينتهي العقد بانتهاء مدته، ما لم يتم تجديده كتابيًا.
      </div>
    </div>

    <!-- المادة 03 -->
    <div style="margin-bottom:5px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 03: مكان العمل
      </div>
      <div style="padding:5px 10px;font-size:11.5px;line-height:1.6;color:#0f172a;">
        يمارس الطرف الثاني مهامه بـ <strong>{{workplace}}</strong>، أو بأي منشأة رياضية يكلف بها من طرف النادي في إطار نشاط فرع السباحة.
      </div>
    </div>

    <!-- المادة 04 -->
    <div style="margin-bottom:5px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 04: أوقات العمل
      </div>
      <div style="padding:5px 10px;font-size:11.5px;line-height:1.6;color:#0f172a;">
        يلتزم الطرف الثاني باحترام جدول العمل الذي تحدده إدارة فرع السباحة ({{work_schedule}})، والحضور قبل بداية العمل بـ 15 دقيقة، ويمنع مغادرة المنصب دون ترخيص مسبق.
      </div>
    </div>

    <!-- المادة 05 -->
    <div style="margin-bottom:5px;border:1.5px solid #0f766e40;border-radius:6px;overflow:hidden;break-inside:avoid;background:#f0fdfa30;">
      <div style="background:#0f766e15;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #0f766e25;">
        المادة 05: الأجر
      </div>
      <div style="padding:5px 10px;font-size:11.5px;line-height:1.6;font-weight:700;color:#0f766e;text-align:center;">
        {{wage_clause}}
      </div>
    </div>

    <!-- المادة 06 -->
    <div style="margin-bottom:5px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 06: مهام حارس السباحة
      </div>
      <div style="padding:5px 10px;font-size:11px;line-height:1.6;color:#0f172a;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;">
          <div>• مراقبة جميع السباحين دون انقطاع.</div>
          <div>• التدخل الفوري في حالات الغرق أو الخطر.</div>
          <div>• تقديم الإسعافات الأولية الضرورية.</div>
          <div>• الاتصال بالحماية المدنية عند الضرورة.</div>
          <div>• التأكد يوميًا من جاهزية معدات الإنقاذ.</div>
          <div>• الإبلاغ عن أي خطر أو عطب داخل المسبح.</div>
          <div>• السهر على احترام النظام الداخلي للمسبح.</div>
          <div>• تحرير تقرير كتابي عن كل حادث.</div>
        </div>
      </div>
    </div>

    <!-- المادة 07 -->
    <div style="margin-bottom:5px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 07: الالتزامات المهنية
      </div>
      <div style="padding:5px 10px;font-size:11px;line-height:1.6;color:#0f172a;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;">
          <div>• ارتداء الزي الرسمي والشارة المهنية.</div>
          <div>• المحافظة على ممتلكات وتجهيزات النادي.</div>
          <div>• احترام السر المهني والانضباط التام.</div>
          <div>• حسن معاملة المنخرطين وأوليائهم.</div>
          <div>• عدم استعمال الهاتف أثناء مراقبة الحوض.</div>
          <div>• منع التدخين أو تناول أي مادة تؤثر على اليقظة.</div>
          <div style="grid-column:span 2;">• المحافظة المستمرة على نظافة ونظام مكان العمل.</div>
        </div>
      </div>
    </div>

    <!-- المادة 08 -->
    <div style="margin-bottom:4px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:4px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 08: الغياب والعطل
      </div>
      <div style="padding:5px 10px;font-size:11.5px;line-height:1.6;color:#0f172a;">
        يجب على الطرف الثاني إبلاغ رئيس الفرع بأي غياب مسبقًا، مع تقديم تبرير قانوني مقبول عند الاقتضاء وفقًا للنظام الداخلي.
      </div>
    </div>

  </div>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- 📄 الصفحة الثانية: المادتان 09 و 10 + التواقيع الثلاثية الرسمية       -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <div class="contract-page contract-page-2" style="page-break-before:always;break-before:page;margin-top:20px;">

    <!-- المادة 09 -->
    <div style="margin-bottom:6px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:5px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 09: إنهاء العقد
      </div>
      <div style="padding:6px 10px;font-size:11.5px;line-height:1.6;color:#0f172a;">
        <span>يمكن إنهاء هذا العقد قبل انتهاء مدته في حالات: </span>
        <strong>الإهمال الجسيم، الغياب غير المبرر، مخالفة تعليمات السلامة، سوء السلوك المهني، تعريض حياة السباحين للخطر، أو فقدان المؤهلات القانونية</strong>. ويتم ذلك وفقًا لأحكام قانون العمل الجزائري.
      </div>
    </div>

    <!-- المادة 10 -->
    <div style="margin-bottom:8px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;break-inside:avoid;">
      <div style="background:#f1f5f9;padding:5px 10px;font-weight:700;color:#0f766e;font-size:12px;border-bottom:1px solid #e2e8f0;">
        المادة 10: أحكام عامة ومكان التحرير
      </div>
      <div style="padding:6px 10px;font-size:11.5px;line-height:1.6;color:#0f172a;">
        يخضع هذا العقد للتشريع المعمول به في الجمهورية الجزائرية الديمقراطية الشعبية وللنظام الداخلي للنادي.
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;margin-top:6px;border-top:1px dashed #cbd5e1;font-weight:700;font-size:11.5px;color:#0f766e;">
          <span>حرر بـ <strong>{{city}}</strong> في: <strong>{{contract_date}}</strong></span>
          <span>حرر في نسختين أصليتين، تسلم نسخة لكل طرف للعمل بموجبها.</span>
        </div>
      </div>
    </div>

    <!-- التواقيع الثلاثية الرسمية -->
    <div style="margin-top:8px;border:1.5px solid #0f766e;border-radius:8px;background:#fff;overflow:hidden;break-inside:avoid;">
      <div style="background:#f0fdfa;color:#0f766e;font-weight:700;font-size:12px;padding:4px 10px;border-bottom:1px solid #0f766e30;text-align:center;">
        المصادقة والتواقيع الرسمية
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:8px 10px;text-align:center;align-items:start;">
        
        <!-- الطرف الأول -->
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#f8fafc;min-height:110px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <p style="font-weight:700;font-size:11.5px;color:#0f766e;margin:0 0 2px 0;">الطرف الأول (صاحب العمل)</p>
            <p style="font-size:10.5px;color:#475569;margin:0 0 2px 0;">الصفة: <strong>{{first_party_role}}</strong></p>
            <p style="font-size:11px;color:#0f172a;margin:0;">الاسم: <strong>{{first_party_rep}}</strong></p>
          </div>
          <div style="margin-top:25px;border-top:1px dashed #94a3b8;padding-top:3px;font-size:10px;color:#64748b;">
            الإمضاء والختم
          </div>
        </div>

        <!-- الطرف الثاني -->
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#f8fafc;min-height:110px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <p style="font-weight:700;font-size:11.5px;color:#0284c7;margin:0 0 2px 0;">الطرف الثاني (العامل)</p>
            <p style="font-size:10.5px;color:#475569;margin:0 0 2px 0;">المهنة: <strong>{{position}}</strong></p>
            <p style="font-size:11px;color:#0f172a;margin:0;">الاسم: <strong>{{worker_name}}</strong></p>
          </div>
          <div style="margin-top:25px;border-top:1px dashed #94a3b8;padding-top:3px;font-size:10px;color:#64748b;">
            الإمضاء
          </div>
        </div>

        <!-- تأشيرة رئيس الجمعية -->
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#f8fafc;min-height:110px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <p style="font-weight:700;font-size:11.5px;color:#d97706;margin:0 0 2px 0;">تأشيرة رئيس الجمعية</p>
            <p style="font-size:10.5px;color:#475569;margin:0 0 2px 0;">الصفة: <strong>{{association_president_role}}</strong></p>
            <p style="font-size:11px;color:#0f172a;margin:0;">الاسم: <strong>{{association_president}}</strong></p>
          </div>
          <div style="margin-top:25px;border-top:1px dashed #94a3b8;padding-top:3px;font-size:10px;color:#64748b;">
            الإمضاء والختم
          </div>
        </div>

      </div>
    </div>

  </div>

</div>`;


