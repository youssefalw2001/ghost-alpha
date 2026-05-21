"use client";

import { useMemo, useState } from "react";
import type { Restaurant } from "@/data/restaurants";

type Position = {
  lat: number;
  lng: number;
  accuracy?: number;
};

type FormState = {
  customerName: string;
  customerPhone: string;
  area: string;
  landmark: string;
  description: string;
  floor: string;
  notes: string;
};

const initialForm: FormState = {
  customerName: "",
  customerPhone: "",
  area: "",
  landmark: "",
  description: "",
  floor: "",
  notes: ""
};

function makeMapLink(position?: Position) {
  if (!position) return "";
  return `https://www.google.com/maps/search/?api=1&query=${position.lat},${position.lng}`;
}

function makeWazeLink(position?: Position) {
  if (!position) return "";
  return `https://waze.com/ul?ll=${position.lat},${position.lng}&navigate=yes`;
}

function makeAppleMapsLink(position?: Position) {
  if (!position) return "";
  return `https://maps.apple.com/?ll=${position.lat},${position.lng}`;
}

function makeMakanakCode(restaurant: Restaurant, form: FormState, position?: Position) {
  const city = restaurant.city.slice(0, 3).toUpperCase();
  const area = (form.area || restaurant.area).slice(0, 3).toUpperCase();
  const seed = `${restaurant.slug}-${form.customerPhone}-${position?.lat ?? 0}-${position?.lng ?? 0}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `${city}-${area}-${hash.toString(36).slice(0, 5).toUpperCase()}`;
}

function buildMessage(restaurant: Restaurant, form: FormState, position?: Position) {
  const mapLink = makeMapLink(position);
  const wazeLink = makeWazeLink(position);
  const appleMapsLink = makeAppleMapsLink(position);
  const code = makeMakanakCode(restaurant, form, position);

  return `طلب توصيل جديد\n\nالمطعم: ${restaurant.name}\nكود مكانك: ${code}\n\nالاسم: ${form.customerName || "غير محدد"}\nالهاتف: ${form.customerPhone || "غير محدد"}\nالمنطقة: ${form.area || restaurant.area}\nأقرب معلم: ${form.landmark || "غير محدد"}\nوصف البيت / العمارة: ${form.description || "غير محدد"}\nالدور / الشقة: ${form.floor || "غير محدد"}\nملاحظات: ${form.notes || "لا يوجد"}\n\nالموقع على Google Maps:\n${mapLink || "لم يتم تحديد الموقع"}\n\nWaze:\n${wazeLink || "لم يتم تحديد الموقع"}\n\nApple Maps:\n${appleMapsLink || "لم يتم تحديد الموقع"}`;
}

export function LocationForm({ restaurant }: { restaurant: Restaurant }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [position, setPosition] = useState<Position | undefined>();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const message = useMemo(() => buildMessage(restaurant, form, position), [restaurant, form, position]);
  const canSend = Boolean(form.customerName.trim() && form.customerPhone.trim() && form.area.trim());

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function useCurrentLocation() {
    setError("");
    setStatus("جاري تحديد موقعك...");

    if (!navigator.geolocation) {
      setStatus("");
      setError("المتصفح لا يدعم تحديد الموقع. اكتب وصف العنوان يدوياً.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          lat: Number(result.coords.latitude.toFixed(6)),
          lng: Number(result.coords.longitude.toFixed(6)),
          accuracy: Math.round(result.coords.accuracy)
        });
        setStatus("تم تحديد الموقع. يمكنك الآن إرسال العنوان عبر واتساب.");
      },
      () => {
        setStatus("");
        setError("لم نتمكن من أخذ الموقع. اسمح للموقع من المتصفح أو اكتب الوصف يدوياً.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setStatus("تم نسخ رسالة العنوان.");
  }

  function sendWhatsApp() {
    if (!canSend) {
      setError("اكتب الاسم ورقم الهاتف والمنطقة قبل الإرسال.");
      return;
    }

    const url = `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="card">
      <div className="restaurant-chip" style={{ borderColor: restaurant.brandColor }}>
        <span>{restaurant.name}</span>
        <small>{restaurant.city} - {restaurant.area}</small>
      </div>

      <div className="form">
        <label>
          الاسم
          <input value={form.customerName} onChange={(event) => updateField("customerName", event.target.value)} placeholder="مثال: أحمد" />
        </label>

        <label>
          رقم الهاتف
          <input value={form.customerPhone} onChange={(event) => updateField("customerPhone", event.target.value)} placeholder="77xxxxxxx" inputMode="tel" />
        </label>

        <label>
          المنطقة
          <input value={form.area} onChange={(event) => updateField("area", event.target.value)} placeholder="مثال: حدة" />
        </label>

        <label>
          أقرب معلم
          <input value={form.landmark} onChange={(event) => updateField("landmark", event.target.value)} placeholder="مثال: بجانب سوبرماركت النور" />
        </label>

        <label>
          وصف البيت / العمارة
          <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="مثال: عمارة بيضاء، البوابة السوداء، بعد البقالة مباشرة" />
        </label>

        <label>
          الدور / الشقة
          <input value={form.floor} onChange={(event) => updateField("floor", event.target.value)} placeholder="مثال: الدور الثاني، شقة 4" />
        </label>

        <label>
          ملاحظات إضافية
          <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="أي تفاصيل تساعد السائق" />
        </label>
      </div>

      <div className="actions">
        <button className="button secondary" type="button" onClick={useCurrentLocation}>استخدم موقعي الحالي</button>
        <button className="button primary" type="button" onClick={sendWhatsApp}>إرسال العنوان عبر واتساب</button>
        <button className="button secondary" type="button" onClick={copyMessage}>نسخ رسالة العنوان</button>
      </div>

      {status ? <div className="success">{status}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {position ? (
        <div className="location-box">
          <strong>تم التقاط الإحداثيات</strong>
          <span>{position.lat}, {position.lng}</span>
          {position.accuracy ? <span>الدقة التقريبية: {position.accuracy} متر</span> : null}
        </div>
      ) : null}

      <div className="card soft-card">
        <h2>معاينة الرسالة</h2>
        <pre className="preview">{message}</pre>
      </div>
    </div>
  );
}
