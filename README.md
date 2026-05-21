# Ghost Alpha - Makanak WhatsApp MVP

This repo now contains the simple free WhatsApp version of Makanak.

Makanak lets a restaurant send one link to a customer. The customer fills in their delivery details, taps to share GPS location, and the app opens WhatsApp with a ready-made delivery address message for the restaurant.

No paid credits. No Supabase. No backend. No Google Maps API key.

## Demo links

```txt
/r/albasha
/r/cafeaden
```

## How it works

```txt
1. Restaurant sends its link to the customer.
2. Customer enters name, phone, area, landmark, and building description.
3. Customer taps "use my current location".
4. App creates Google Maps, Waze, and Apple Maps links.
5. App opens WhatsApp with the full delivery card ready to send.
```

## Run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
http://localhost:3000/r/albasha
```

## Change restaurant WhatsApp numbers

Open:

```txt
data/restaurants.ts
```

Change the `whatsapp` field to the real Yemen WhatsApp number in international format without plus signs, spaces, or symbols.

Example:

```txt
96777xxxxxxx
```

## Add another restaurant

1. Add a restaurant object in `data/restaurants.ts`.
2. Copy one of the folders inside `app/r/`.
3. Rename it to the restaurant slug.
4. Change the slug used in the page file.

Later, this can be upgraded to dynamic restaurant links and a database.
