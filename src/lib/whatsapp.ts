/**
 * ═══════════════════════════════════════════════════════════════
 *  طبقة أتمتة WhatsApp — مزوّدان:
 *  1) "cloud": Meta WhatsApp Cloud API (يتطلب WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
 *  2) "link":  روابط wa.me جاهزة للفتح اليدوي (الوضع الافتراضي بدون أسرار)
 * ═══════════════════════════════════════════════════════════════
 */

export interface WhatsAppSendResult {
  mode: "cloud" | "link" | "skipped";
  url?: string; // رابط wa.me (الوضع اليدوي)
  providerMessageId?: string;
  error?: string;
}

export function isCloudConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** توحيد الهاتف الجزائري: إزالة الرموز + بادئة 213 */
export function normalizeDzPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let phone = raw.replace(/\D/g, "");
  if (!phone) return null;
  if (phone.startsWith("0")) phone = "213" + phone.slice(1);
  else if (!phone.startsWith("213")) phone = "213" + phone;
  return phone.length >= 12 ? phone : null;
}

/** تعويض المتغيرات في قالب النادي: {name} {date} {file} {club} {portal} */
export function renderTemplate(
  template: string,
  vars: { name: string; date?: string; file?: string; club?: string; portal?: string }
): string {
  return template
    .replace(/{name}/g, vars.name)
    .replace(/{date}/g, vars.date || "—")
    .replace(/{file}/g, vars.file || "—")
    .replace(/{club}/g, vars.club || "النادي")
    .replace(/{portal}/g, vars.portal || "");
}

/** إرسال عبر المزوّد المهيأ — أو إرجاع رابط wa.me في الوضع اليدوي */
export async function sendWhatsApp(to: string, message: string): Promise<WhatsAppSendResult> {
  if (!isCloudConfigured()) {
    return { mode: "link", url: `https://wa.me/${to}?text=${encodeURIComponent(message)}` };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { mode: "skipped", error: `meta_${res.status}: ${t.slice(0, 140)}` };
    }
    const data = await res.json();
    return { mode: "cloud", providerMessageId: data?.messages?.[0]?.id };
  } catch (e: unknown) {
    return { mode: "skipped", error: e instanceof Error ? e.message : "network" };
  }
}
