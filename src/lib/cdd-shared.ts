/**
 * ثوابت النموذج الرسمي CDD المشتركة (آمنة للعميل والخادم)
 * — مفصولة عن cdd-template.ts لأن الأخير يستورد Prisma (خادم فقط)
 */

/** رمز النموذج الرسمي في ContractTemplate.code */
export const CDD_TEMPLATE_CODE = "cdd-lifeguard";

/** علامة تمييز العقود المُنشأة من النموذج الرسمي (أول محتوى HTML) */
export const CDD_OFFICIAL_MARKER = "<!--CDD-OFFICIAL";

/** أنماط المستند الرسمي — تُحقن داخل المعاينة والطباعة وWord */
export const CDD_TEMPLATE_CSS = `
.cdd-doc{font-family:'Cairo','Tahoma',Arial,sans-serif;color:#111827;font-size:12.5px;line-height:2;}
.cdd-title-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-bottom:2px solid #111827;padding-bottom:6px;margin-bottom:10px;}
.cdd-title{font-weight:800;font-size:15px;}
.cdd-ref{font-weight:600;font-size:12px;color:#374151;}
.cdd-intro{font-weight:700;text-align:center;margin:8px 0;}
.cdd-h{font-weight:800;font-size:13px;margin:12px 0 2px;text-decoration:underline;text-underline-offset:4px;}
.cdd-art{font-weight:800;font-size:13px;margin:12px 0 2px;color:#111827;}
.cdd-p{margin:3px 0;text-align:justify;}
.cdd-ul{margin:2px 18px 6px 0;padding:0;list-style:none;}
.cdd-ul li{position:relative;padding-right:14px;margin:1px 0;}
.cdd-ul li::before{content:"•";position:absolute;right:0;font-weight:700;}
.cdd-fill{font-weight:700;color:#111827;min-width:60px;display:inline-block;}
.cdd-fill.ltr{direction:ltr;unicode-bidi:embed;}
.cdd-date,.cdd-num{direction:ltr;unicode-bidi:embed;font-size:12.5px;}
.cdd-signed{font-weight:700;margin:14px 0 4px;}
.cdd-signs{display:flex;gap:10px;margin-top:26px;break-inside:avoid;}
.cdd-sign{flex:1;text-align:center;border:1px solid #d1d5db;border-radius:8px;padding:10px 8px 14px;}
.cdd-sign-h{font-weight:800;font-size:12px;text-decoration:underline;text-underline-offset:3px;margin-bottom:8px;}
.cdd-sign p{font-size:11.5px;margin:4px 0;text-align:right;}
.cdd-stamp{margin-top:34px !important;color:#6b7280;font-size:10.5px !important;text-align:center !important;border-top:1px dashed #9ca3af;padding-top:4px;}
@media print{
  .cdd-doc{font-size:11.5px;}
  .cdd-signs{gap:6px;}
}
`;
