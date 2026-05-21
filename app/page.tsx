import Link from "next/link";
import { restaurants } from "@/data/restaurants";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero-card">
        <div className="badge">Makanak MVP</div>
        <h1>رابط موقع التوصيل للمطاعم</h1>
        <p>
          صفحة بسيطة تجعل الزبون يرسل موقعه ووصف العنوان إلى المطعم عبر واتساب بدون مكالمات طويلة.
        </p>
      </section>

      <section className="card">
        <h2>روابط التجربة</h2>
        <p>اختر مطعم تجريبي وافتح صفحة إرسال الموقع.</p>
        <div className="link-list">
          {restaurants.map((restaurant) => (
            <Link className="button secondary" href={`/r/${restaurant.slug}`} key={restaurant.slug}>
              {restaurant.name} - /r/{restaurant.slug}
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>كيف يعمل؟</h2>
        <div className="steps">
          <div>1. المطعم يرسل الرابط للزبون.</div>
          <div>2. الزبون يكتب الوصف ويضغط استخدم موقعي.</div>
          <div>3. التطبيق يجهز رسالة واتساب كاملة للمطعم.</div>
        </div>
      </section>

      <p className="footer">Built for Yemen delivery workflows. WhatsApp-first. No backend required.</p>
    </main>
  );
}
