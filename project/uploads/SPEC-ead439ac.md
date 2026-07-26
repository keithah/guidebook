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

Five sections, mapping to the five questions guests actually have: *how do I get in, how does this place work, what's nearby, what should I do in SF, who do I call.* Nothing sits more than one tap deep. **Home** is the stay-phase-aware screen, not a section; the quick-actions bar means the four most-needed things (WiFi, codes, host, departures) never require navigating.

### 1. Arrive
- Getting here — from SFO (BART), from OAK, driving
- Parking — 1 free driveway space, free street parking
- Getting in — step-by-step gate + door keypad walkthrough with photos
- Practical notes — early arrival policy, luggage note (narrow alley)

### 2. The Cottage
- About the space — the cottage's story, Ingleside/City College context, Keith's hosting story
- Room by room — living (sofa-bed topper tip), BR1, loft BR2 (low ceiling warning), kitchen, bathroom, laundry, shared courtyard/firepit
- WiFi & appliances — WiFi, TVs/Netflix, Keurig vs drip, Sodastream, dishwasher, washer/dryer, heating + portable fans + air purifier (no A/C)
- House rules — occupancy, shoes off, pets, quiet hours, re-locking
- Trash & recycling — SF three-bin rules, pickup day
- Work setup — 2 desks, 817 Mbps, video-call tips
- Troubleshooting — breaker, water shutoff, WiFi reboot, packages
- *Family:* pack-and-play availability

### 3. Around Here *(everything walkable)*
- Transit — inline map with pins & walk times, live K/BART/J/M/bus departures, Clipper via Apple/Google Pay, Muni vs BART primer, rideshare notes, recommended apps
- Eat & drink — curated walkable list (Philz, Beeps, Pakwan, Sakesan…) with map pins, walk times, hours, Keith's one-line takes
- Groceries & essentials — Whole Foods 4 min, Safeway, Walgreens, Stonestown, Serramonte, pharmacy, ATM
- Delivery services — DoorDash/Uber Eats/Grubhub, Instacart/Amazon Fresh, package handling, late-night options
- Cafes to work from

### 4. Explore SF
- Neighborhoods to explore — Mission, Chinatown, Golden Gate Park, Ocean Beach/Sunset, downtown/Embarcadero… each with transit route from the cottage + what to do there
- Interest filters — *Nature & hiking* (Lands End, Twin Peaks, Ocean Beach), *Got a car?* (Muir Woods, Half Moon Bay, wine country), *Wine tasting*, *Museums*, *With kids* (SF Zoo, Cal Academy, playgrounds), *Dog-friendly*
- What's on — seasonal events; windowed to stay dates when hash present
- SF tips & safety — layers/fog reality, car break-in warning, earthquake basics, tipping, neighborhood context

### 5. Help
- Emergency — 911, SF non-emergency, 311, nearest urgent care & ER, fire extinguisher & first-aid locations
- Contact Keith — Airbnb thread, SMS
- Checkout — time, checklist, review nudge
- Book direct + guide feedback

*(Incorporates Keith's Notion "Welcome book" outline: Arriving → Parking/Getting In, History/About the space, SF Cottage Details → WiFi/Heating/Fans/Purifier/TV/Kitchen, Neighborhood → Where to Eat/Stores Nearby, Activities → Neighborhoods to Explore/Outdoors, Transit, Groceries, Delivery Services.)*

## Live data

- **Transit departures**: 511.org API (Muni + BART), UMO as fallback — quick-actions bar + Around Here
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
- Standalone Kids & Pets section (distributed: pack-and-play in The Cottage, family/dog-friendly picks tagged in Explore SF)
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
