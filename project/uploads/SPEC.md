# Guidebook — Product Spec

A guest guidebook for short-term rentals, delivered as an installable PWA and a printable PDF, generated from one content source per property. First property: **The SF Cottage** (251 Harold Ave, SF 94112 — airbnb.com/h/sfcottage). Hosted on GitHub Pages. Implementation details deliberately deferred; this spec covers content and experience.

## Audiences & access modes

**Guest with a per-stay link** (`/sfcottage#<hash>`): every booking gets a unique link. Stay data (injected via an airbnb.com scraping pipeline, defined later) unlocks:
- Gate & door codes
- Personal greeting, stay dates, and stay-phase awareness
- Stay-specific notes/flags (pet fee acknowledged, pack-and-play ready, early check-in granted)
- Weather forecast and events windowed to their dates

**Generic visitor** (no hash): the full guide minus codes and anything personal. Doubles as marketing — includes the book-direct pitch. Never shows any guest's info.

## Core experience

**Stay-phase aware home screen.** The home adapts:
- *Before arrival*: getting here (SFO/BART directions, driving), check-in time, what to pack (layers!), arrival-day weather
- *During stay*: quick actions front and center, today's weather, transit departures, browse sections
- *Checkout day*: checkout checklist first, thank-you, book-direct pitch, guide feedback form

**Persistent quick-actions bar** (always one tap):
1. WiFi — tap to copy password + QR to auto-join
2. Door/gate codes (hash-gated)
3. Message host — Airbnb thread deep link / SMS
4. Next departures — live K-line + BART times (511.org; UMO fallback)

**Voice:** first-person Keith throughout. Personal, specific, opinionated ("My favorite burger in the city is 2 minutes away").

**Search:** global search across all sections.

**Offline:** installable PWA; all content (incl. map tiles for the neighborhood) cached for offline use. Live data degrades gracefully.

**Languages:** English only, with a visible hint that browser translate (Chrome/Safari) works well on the app.

## Sections (IA)

1. **Welcome** — greeting (personalized w/ hash), cottage photo, address, registration #, host intro
2. **Getting Here / Arriving** — from SFO (BART), from OAK, driving; parking (1 driveway space + free street); step-by-step keypad entry ("Getting In") with photos; luggage note (narrow alley); early-arrival policy
3. **About the Space** — the cottage's story/history, the neighborhood's character (Ingleside history, City College), Keith's hosting story. Warm, personal, sets the tone.
4. **The Cottage** — room-by-room (living/sofa-bed topper tip, BR1, loft BR2 low-ceiling warning, kitchen, bathroom, laundry, shared courtyard/firepit); appliance how-tos (WiFi, TVs/Netflix, Keurig vs drip, Sodastream, dishwasher, washer/dryer, heating + portable fans + air purifier, no A/C); house rules; trash/recycling/compost (SF three-bin rules + pickup day); troubleshooting/FAQ (breaker, water shutoff, WiFi reboot, packages)
5. **Getting Around** — inline map (Leaflet/OSM) with transit pins & walk times; K/BART/J/M/buses with live departures; Clipper via Apple/Google Pay explainer; Muni vs BART primer; rideshare/taxi notes; app recommendations
6. **Eat & Drink** — curated walkable list (Philz, Beeps, Pakwan, Sakesan, etc.) with map pins, walk times, hours, Keith's one-line takes
7. **Delivery Services** — DoorDash/Uber Eats/Grubhub coverage notes, Instacart/Amazon Fresh groceries, package deliveries (go to host's front door), late-night options
8. **Groceries & Essentials** — Whole Foods 4 min, Safeway, Walgreens, Stonestown, Serramonte; pharmacy; ATM
9. **Explore SF** — organized by **neighborhoods to explore** (Mission, Chinatown, Golden Gate Park, Ocean Beach/Sunset, downtown/Embarcadero…) each with transit route from the cottage + what to do there; plus **interest-based suggestions**: *Into hiking/nature?* (Lands End, Twin Peaks…), *Have a car?* (Muir Woods, Half Moon Bay, wine country), *Wine tasting?*, *Museums?*, *With kids?* — tagged so guests filter by interest
10. **Work From Cottage** — desks, 817 Mbps WiFi, video-call tips, cafes to work from
11. **Kids & Pets** — pack-and-play, playgrounds/parks, SF Zoo nearby, vets, pet stores, dog-friendly spots
12. **SF Tips & Safety** — layers/fog weather reality, car break-in warning (never leave items visible), earthquake basics, tipping culture, neighborhood context
13. **What's On** — seasonal events calendar; windowed to stay dates when hash present
14. **Emergency** — 911/non-emergency/311, nearest urgent care & ER, fire extinguisher/first-aid locations, host contact
15. **Checkout** — time, checklist, review nudge, book-direct pitch, guide feedback form

*(Section framing incorporates Keith's Notion "Welcome book" outline: Arriving → Parking/Getting In, History/About the space, SF Cottage Details → WiFi/Heating/Fans/Purifier/TV/Kitchen, Neighborhood → Where to Eat/Stores Nearby, Activities → Neighborhoods to Explore/Outdoors, Transit, Groceries, Delivery Services.)*

## Live data

- **Transit departures**: 511.org API (Muni + BART), UMO as fallback — quick-actions bar + Getting Around
- **Weather**: NWS API — home screen + stay window
- **Events**: curated list first; feed integration later

## Print outputs (from the same content)

1. **Full guidebook PDF** — print stylesheet on a `/print` route; paginated, static maps replace interactive ones; codes redacted unless printed from a hashed link
2. **One-page essentials sheet** — WiFi, codes, transit cheat sheet, host contact, checkout list; for the counter/fridge
3. **QR codes** on printed pages linking into the corresponding app section (live maps/departures)

## Engagement

- Book-direct pitch (generic mode + checkout screen)
- Guide feedback form ("what was missing?")

## Non-goals (v1)

- Fixed day-plan itineraries (interest tags instead)
- Human-translated content
- Comprehensive venue directory (curation over completeness)
- In-app messaging (deep-link to Airbnb/SMS instead)

## Multi-property

All content lives in `properties/<slug>.json`. One codebase renders any property; adding a unit = adding a JSON file (+ photos). SF Cottage data already captured in `properties/sfcottage.json` (TODOs flagged inline for host-only facts).

## Open items

- Branding: 2–3 design mockups to review (next step)
- Fill TODOs in `sfcottage.json` (WiFi, codes handling, phone, emergency locations, quiet hours, checkout expectations)
- Define the per-stay scraping/injection pipeline (implementation phase)
- Photos: entry walkthrough shots, room photos, thermostat/appliance closeups
