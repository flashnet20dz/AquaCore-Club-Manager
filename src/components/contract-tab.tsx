"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileSignature, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";

const DEFAULT_CONTRACT_TEXT = `أقرّ أنا الموقّع أدناه بالموافقة على الشروط والأحكام التالية للانخراط بالنادي:
1. الالتزام بمواعيد الحصص المحددة واحترام تعليمات المدربين.
2. تحمّل مسؤولية الحالة الصحية للمنخرط وإخطار النادي بأي حالة طبية خاصة.
3. الاشتراك غير قابل للاسترجاع بعد الدفع، ويخضع لسياسة التجديد والتجميد المعمول بها بالنادي.
4. يحق للنادي تعديل الجدول الزمني للحصص عند الضرورة (صيانة، ظروف قاهرة)، مع تعويض الحصص المتأثرة.
5. الموافقة على استخدام الصور/الفيديوهات الملتقطة داخل النادي لأغراض ترويجية ما لم يُطلب خلاف ذلك كتابياً.`;

interface Contract {
  id: string;
  contractText: string;
  signerName: string;
  signatureImage: string;
  signedAt: string;
}

export function ContractTab({ subscriberId, subscriberName }: { subscriberId: string; subscriberName: string }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/subscribers/${subscriberId}/contract`);
        const data = await res.json();
        setContract(data.contract || null);
      } catch {
        // تجاهل
      } finally {
        setLoading(false);
      }
    })();
  }, [subscriberId]);

  const submit = async () => {
    if (!signerName.trim()) { toast.error("اسم الموقّع مطلوب"); return; }
    if (padRef.current?.isEmpty()) { toast.error("يرجى التوقيع أولاً"); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/subscribers/${subscriberId}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractText: DEFAULT_CONTRACT_TEXT,
          signerName: signerName.trim(),
          signatureImage: padRef.current?.toDataURL(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("تم توقيع العقد بنجاح");
      setContract(data.contract);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر حفظ التوقيع");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (contract) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4" /> تم توقيع العقد
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-line text-muted-foreground max-h-40 overflow-y-auto">
          {contract.contractText}
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground">الموقّع</p>
            <p className="text-sm font-semibold">{contract.signerName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              بتاريخ {new Date(contract.signedAt).toLocaleString("ar-DZ")}
            </p>
          </div>
          <div className="border rounded-lg bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={contract.signatureImage} alt="التوقيع" className="max-h-16 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
        <FileSignature className="h-4 w-4" /> لم يُوقَّع العقد بعد
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-line text-muted-foreground max-h-40 overflow-y-auto">
        {DEFAULT_CONTRACT_TEXT}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">اسم الموقّع (المنخرط أو ولي الأمر)</Label>
        <Input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder={subscriberName}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">التوقيع</Label>
        <SignaturePad ref={padRef} />
      </div>
      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <FileSignature className="h-4 w-4 ml-1" />}
        تأكيد التوقيع
      </Button>
    </div>
  );
}
