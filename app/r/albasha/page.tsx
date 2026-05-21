import Link from "next/link";
import { LocationForm } from "@/components/LocationForm";
import { getRestaurant } from "@/data/restaurants";

export default function AlBashaPage() {
  const restaurant = getRestaurant("albasha")!;

  return (
    <main className="page">
      <Link className="small back-link" href="/">العودة للرئيسية</Link>

      <section className="hero-card">
        <div className="badge">حدد موقعك للتوصيل</div>
        <h1>{restaurant.name}</h1>
        <p>اكتب تفاصيل العنوان واضغط على زر الموقع. بعدها سيتم فتح واتساب برسالة جاهزة للمطعم.</p>
      </section>

      <LocationForm restaurant={restaurant} />

      <p className="footer">Powered by Makanak</p>
    </main>
  );
}
