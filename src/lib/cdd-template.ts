import { db } from "@/lib/db";
import { CDD_TEMPLATE_CODE, CDD_TEMPLATE_CSS } from "@/lib/cdd-shared";

export { CDD_TEMPLATE_CODE, CDD_TEMPLATE_CSS };

/**
 * النموذج الرسمي — عقد عمل محدد المدة (CDD)
 * ═══════════════════════════════════════════════════════════════
 * النص الرسمي المعتمد (نموذج النادي) — يُزرع تلقائياً لكل نادي
 * (idempotent: يُنشأ إن غاب ولا يُكتب فوق تعديلات الإدارة).
 *
 * المتغيرات تُستبدل عند الإنشاء عبر renderContractHTML() مع خطوط
 * منقّطة «................» لكل حقل فارغ — فلا يظهر «—» في وثيقة رسمية.
 *
 * ★ الترويسة الموحدة (unifiedReportHeaderHTML) تُضاف في العرض/الطباعة
 *   وليست جزءاً من محتوى القالب المخزّن.
 */

export const CDD_TEMPLATE = {
  name: "عقد عمل محدد المدة (CDD) — النموذج الرسمي",
  code: CDD_TEMPLATE_CODE,
  description:
    "النموذج الرسمي المعتمد: عقد محدد المدة لحارس السباحة (منقذ مائي) — يحدد معلومات الطرف الأول والطرف الثاني وتأشيرة رئيس الجمعية",
  defaultDuration: 92, // 21/06 → 21/09 تقريباً (الموسم الصيفي)
  content: `<!--CDD-OFFICIAL:v2-->
<div dir="rtl" class="cdd-doc">
<p class="cdd-title-row"><span class="cdd-title">عقد عمل محدد المدة (CDD)</span><span class="cdd-ref">رقم: <span class="cdd-fill">{{contract_number}}</span> / ن.ر.ر.س. <span class="cdd-fill">{{season_year}}</span></span></p>

<p class="cdd-intro">بين الموقعين أدناه:</p>

<h3 class="cdd-h">الطرف الأول (صاحب العمل):</h3>
<p class="cdd-p">الجمعية الرياضية الهاوية {{club_name}}، الكائن مقرها بـ: <span class="cdd-fill">{{club_seat}}</span>، ويمثلها في هذا العقد السيد: <span class="cdd-fill">{{first_party_representative}}</span> بصفته {{first_party_rep_title}}.</p>
<p class="cdd-p"><strong>ويشار إليه في هذا العقد بـ "الطرف الأول".</strong></p>

<h3 class="cdd-h">الطرف الثاني (العامل):</h3>
<p class="cdd-p">الاسم واللقب: <span class="cdd-fill">{{worker_name}}</span> . تاريخ ومكان الميلاد: <span class="cdd-fill">{{birth_date}}</span> / <span class="cdd-fill">{{birth_place}}</span> — العنوان: <span class="cdd-fill">{{address}}</span></p>
<p class="cdd-p">رقم بطاقة التعريف الوطنية: <span class="cdd-fill ltr">{{national_id}}</span> . رقم الهاتف: <span class="cdd-fill ltr">{{phone}}</span></p>
<p class="cdd-p"><strong>ويشار إليه في هذا العقد بـ "الطرف الثاني".</strong></p>

<h3 class="cdd-art">المادة 01: موضوع العقد</h3>
<p class="cdd-p">يوظف الطرف الأول الطرف الثاني بصفة <strong>{{position_title}}</strong> للعمل بالمسبح، قصد ضمان أمن وسلامة السباحين، ومراقبة النشاطات المائية، والتدخل عند الضرورة، طبقًا للتشريع المعمول به.</p>

<h3 class="cdd-art">المادة 02: مدة العقد</h3>
<p class="cdd-p">يبرم هذا العقد لمدة محددة ابتداءً من: <strong class="cdd-date">{{start_date}}</strong> إلى غاية: <strong class="cdd-date">{{end_date}}</strong> وينتهي العقد بانتهاء مدته، ما لم يتم تجديده كتابيًا.</p>

<h3 class="cdd-art">المادة 03: مكان العمل</h3>
<p class="cdd-p">يمارس الطرف الثاني مهامه بـ{{workplace}}، أو بأي منشأة رياضية يكلف بها من طرف النادي في إطار نشاط فرع السباحة.</p>

<h3 class="cdd-art">المادة 04: أوقات العمل</h3>
<p class="cdd-p">يلتزم الطرف الثاني باحترام جدول العمل الذي تحدده إدارة فرع السباحة.</p>
<ul class="cdd-ul">
  <li>الحضور قبل بداية العمل بـ15 دقيقة.</li>
  <li>يمنع مغادرة المنصب دون ترخيص.</li>
</ul>

<h3 class="cdd-art">المادة 05: الأجر</h3>
<p class="cdd-p">يتقاضى الطرف الثاني أجرًا يُحسب على أساس الحجم الساعي كل شهر.</p>

<h3 class="cdd-art">المادة 06: مهام حارس السباحة</h3>
<p class="cdd-p">يلتزم الطرف الثاني بما يأتي:</p>
<ul class="cdd-ul">
  <li>مراقبة جميع السباحين دون انقطاع.</li>
  <li>التدخل الفوري في حالات الغرق أو الخطر.</li>
  <li>تقديم الإسعافات الأولية.</li>
  <li>الاتصال بالحماية المدنية عند الضرورة.</li>
  <li>التأكد يوميًا من جاهزية معدات الإنقاذ.</li>
  <li>الإبلاغ عن أي خطر أو عطب داخل المسبح.</li>
  <li>السهر على احترام النظام الداخلي للمسبح.</li>
  <li>تحرير تقرير كتابي عن كل حادث.</li>
</ul>

<h3 class="cdd-art">المادة 07: الالتزامات المهنية</h3>
<p class="cdd-p">يلتزم الطرف الثاني بما يلي:</p>
<ul class="cdd-ul">
  <li>ارتداء الزي الرسمي والشارة المهنية.</li>
  <li>المحافظة على ممتلكات النادي.</li>
  <li>احترام السر المهني.</li>
  <li>حسن معاملة المنخرطين وأوليائهم.</li>
  <li>عدم استعمال الهاتف أثناء مراقبة السباحين.</li>
  <li>عدم التدخين أو تناول أي مادة تؤثر على اليقظة أثناء العمل.</li>
  <li>المحافظة على نظافة مكان العمل.</li>
</ul>

<h3 class="cdd-art">المادة 08: الغياب والعطل</h3>
<p class="cdd-p">يجب على الطرف الثاني إبلاغ رئيس الفرع بأي غياب مسبقًا، مع تقديم مبرر قانوني عند الاقتضاء.</p>

<h3 class="cdd-art">المادة 09: إنهاء العقد</h3>
<p class="cdd-p">يمكن إنهاء هذا العقد قبل انتهاء مدته في الحالات التالية:</p>
<ul class="cdd-ul">
  <li>الإهمال الجسيم.</li>
  <li>الغياب غير المبرر.</li>
  <li>مخالفة تعليمات السلامة.</li>
  <li>سوء السلوك المهني.</li>
  <li>تعريض حياة السباحين للخطر.</li>
  <li>فقدان المؤهلات القانونية اللازمة لممارسة مهام الإنقاذ.</li>
</ul>
<p class="cdd-p">ويتم ذلك وفقًا لأحكام قانون العمل الجزائري.</p>

<h3 class="cdd-art">المادة 10: أحكام عامة</h3>
<p class="cdd-p">يخضع هذا العقد لأحكام التشريع والتنظيم المعمول بهما في الجمهورية الجزائرية الديمقراطية الشعبية، وللنظام الداخلي للجمعية.</p>

<p class="cdd-signed">حُرر بمدينة {{sign_city}} في: <span class="cdd-fill">{{sign_date}}</span></p>
<p class="cdd-p"><strong>وحُرر هذا العقد من نسختين أصليتين، تسلّم نسخة لكل طرف للعمل بموجبها.</strong></p>

<div class="cdd-signs">
  <div class="cdd-sign">
    <h4 class="cdd-sign-h">الطرف الأول</h4>
    <p>الصفة: <span class="cdd-fill">{{first_party_rep_title}}</span></p>
    <p>الاسم واللقب: <span class="cdd-fill">{{first_party_representative}}</span></p>
    <p class="cdd-stamp">الإمضاء والختم</p>
  </div>
  <div class="cdd-sign">
    <h4 class="cdd-sign-h">الطرف الثاني</h4>
    <p>المهنة: <span class="cdd-fill">{{position_title}}</span></p>
    <p>الاسم واللقب: <span class="cdd-fill">{{worker_name}}</span></p>
    <p class="cdd-stamp">الإمضاء</p>
  </div>
  <div class="cdd-sign">
    <h4 class="cdd-sign-h">تأشيرة رئيس الجمعية الرياضية الهاوية</h4>
    <p>الاسم واللقب: <span class="cdd-fill">{{association_president}}</span></p>
    <p>الصفة: <span class="cdd-fill">{{association_president_title}}</span></p>
    <p class="cdd-stamp">الإمضاء والختم</p>
  </div>
</div>
</div>`,
};

/**
 * ضمان وجود النموذج الرسمي لنادي معيّن (idempotent).
 * - يُنشأ إن غاب (ولا يُحدَّث إن وُجد — احترام تعديلات الإدارة).
 * - آمن للاستدعاء المتكرر في كل GET.
 */
/**
 * ★ ترقية جراحية v1 → v2 للنماذج المخزّنة سابقاً:
 * استبدال عبارتين فقط (المادة 05 بلا سعر الساعة + بلا تكرار «فرع السباحة»)
 * مع الحفاظ الكامل على أي تعديلات إدارية أخرى على القالب.
 */
const CDD_V1_RATE_PHRASE = " بمعدل <strong class=\"cdd-num\">{{hour_rate}}</strong> دج/ساعة، وفق جدول العمل: {{work_schedule}}.";
const CDD_V1_FIRST_PARTY_REPEAT = "الجمعية الرياضية الهاوية {{club_name}} – فرع السباحة، الكائن مقرها";
const CDD_V2_FIRST_PARTY = "الجمعية الرياضية الهاوية {{club_name}}، الكائن مقرها";

async function migrateCddV1ToV2(id: string, content: string): Promise<void> {
  try {
    if (!content || !content.includes("CDD-OFFICIAL:v1")) return;
    let updated = content.replace("<!--CDD-OFFICIAL:v1-->", "<!--CDD-OFFICIAL:v2-->");
    if (updated.includes(CDD_V1_RATE_PHRASE)) {
      updated = updated.replace(CDD_V1_RATE_PHRASE, ".");
    }
    if (updated.includes(CDD_V1_FIRST_PARTY_REPEAT)) {
      updated = updated.replace(CDD_V1_FIRST_PARTY_REPEAT, CDD_V2_FIRST_PARTY);
    }
    if (updated !== content) {
      await db.contractTemplate.update({ where: { id }, data: { content: updated } });
    }
  } catch (e) {
    console.error("migrateCddV1ToV2:", e);
  }
}

export async function ensureCddTemplate(clubId: string): Promise<void> {
  try {
    const existing = await db.contractTemplate.findFirst({
      where: { clubId, code: CDD_TEMPLATE_CODE },
      select: { id: true, content: true },
    });
    if (!existing) {
      await db.contractTemplate.create({
        data: { ...CDD_TEMPLATE, clubId },
      });
      return;
    }
    await migrateCddV1ToV2(existing.id, existing.content);
  } catch (e) {
    // لا يُفشل الطلب أبداً بسبب الزرع — فقط سِجّل
    console.error("ensureCddTemplate:", e);
  }
}
