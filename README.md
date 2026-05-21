# Ghost Alpha - Makanak WhatsApp MVP

The repo is being converted into the Makanak WhatsApp delivery-location MVP.

Makanak lets a restaurant send one link to a customer. The customer shares GPS coordinates, area, nearest landmark, and building description. The app creates a WhatsApp-ready delivery card and charges the restaurant 1 credit per successful location card.

## Current repo status

`package.json` has been updated with Supabase support and a typecheck script.

The connected GitHub tool successfully allowed updating existing files, but it blocked direct creation of new app files. The full app patch is available from the ChatGPT artifact named `ghost-alpha-makanak-patch.zip`.

## Intended demo links after applying the patch

```txt
/r/albasha
/r/cafeaden
/admin
```

Without Supabase env vars, the app runs in demo mode using local demo restaurants.

## Monetization logic

```txt
1 customer location card = 1 restaurant credit
```

Suggested pricing:

```txt
Trial: 20 cards free
Starter: $5 = 100 cards
Pro: $10 = 250 cards
Busy: $20 = 600 cards
```

## Run locally after applying the patch

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000/r/albasha
```

## Add Supabase for paid credits

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add Supabase URL, service role key, and `ADMIN_PIN`.
5. Replace demo WhatsApp numbers with real Yemen WhatsApp numbers in international format without `+`.

Example:

```txt
96777xxxxxxx
```

## How restaurants pay

At MVP stage, collect payment manually through cash, ONE Cash, bank transfer, or exchange transfer. After payment, use `/admin` to add credits to the restaurant slug.
