# PRD: OtherWise

**Author:** Tiffany and Uulkan · **Status:** Draft v0.2 · **Last updated:** October 17, 2026 · **Delivery constraint:** 16 engineering hours

---

## 1. Problem Statement

International budget travelers in the E.U. (tourists, exchange students and foreign workers) routinely overpay abroad because they do not know which everyday products and services are cheaper, or only available, in the country they are visiting. Prices for groceries, transport, telecom, personal care, dining and electronics vary widely across E.U. countries, and travelers default to what they know from home or to whatever is closest. They lack a quick, trustworthy way to see where their money goes further, so they spend more than they need to and miss locally exclusive products worth buying.

The bank is uniquely placed to solve this. It already knows what each customer buys through their transaction history, and it knows when a customer has crossed a border. OtherWise uses these two signals to send a timely notification on arrival in a new country, then shows recommended categories based on the user's past spending, each with a short list of products returned by a product and price API and compared against typical prices in the user's home country. The result is that travelers can spend smartly and conveniently, with no research required.

---

## 2. Goals and Non-Goals

### Goals

1. **Cost efficiency for users:** help users identify products and services that are cheaper (or exclusive) in the country they are in compared with their home country.
2. **Timely, relevant discovery:** deliver recommendations at the moment of arrival, when purchasing decisions are about to be made.
3. **Personalization from existing data:** tailor categories to each user's prior transaction categories, with no manual setup.
4. **Ship an MVP within 16 hours** that covers the full loop: arrival detection, notification, category view and product list.
5. **Respect user trust and privacy:** transparent use of transaction data, with consent and an easy opt-out.

### Non-Goals (Out of Scope for this release)

- Monetization features of any kind: ads, sponsored placements, affiliate or referral revenue.
- Receipt scanning and rewards or cashback.
- Popularity or crowd-sourced recommendations (for example, most purchased by other users).
- Users whose country of residence is outside the E.U., and destinations outside the E.U.
- In-app purchasing or checkout; products open as external links only.
- Real-time price scraping or live inventory and availability checks.
- Itinerary planning, maps or store-locator features.
- Currency conversion tools beyond displaying prices in the user's home currency.

---

## 3. Target Users

**International budget travelers resident in the E.U.:** budget tourists, exchange students (for example, Erasmus) and foreign workers who hold an account with the banking app and have a transaction history of at least a few weeks.

**Eligibility:** the user's country of residence (their "home country" throughout this document, taken from the bank profile) must be an E.U. member state, and OtherWise only activates when they are in a different E.U. member state.

---

## 4. User Stories

### US-1: Arrival notification

**Priority: Must have**

**As a** traveler who has just arrived in a different E.U. country, **I want** to receive a notification from my banking app, **So that** I learn about cheaper options before I start spending.

**Acceptance criteria**

1. **Given** my home country is Germany and I have opted in, **when** the app detects I am in a different E.U. country (for example, Hungary) for the first time in this trip, **then** I receive a push notification within 5 minutes of detection.
2. **Given** I have already received an OtherWise notification for my current trip to a country, **when** I remain in that country or move around within it, **then** I do not receive another notification for it.
3. **Given** I return to my home country, **when** I later travel abroad again, **then** a new trip is recognized and a new notification is allowed.
4. **Given** I am in my home country or in a non-E.U. country, **when** the app evaluates my location, **then** no notification is sent.

---

### US-2: Open recommendations from the notification

**Priority: Must have**

**As a** traveler who received the arrival notification, **I want** to tap it and land on a recommendations screen, **So that** I can see what is worth buying locally without searching.

**Acceptance criteria**

1. **Given** I received the notification, **when** I tap it, **then** the app opens directly to the OtherWise screen for my current country.
2. **Given** the app is closed or in the background, **when** I tap the notification, **then** I am authenticated (per standard app security) and then taken to the OtherWise screen.
3. **Given** the OtherWise screen is loading, **when** content is not yet available, **then** I see a loading state and not a blank screen.
4. **Given** I dismiss the notification without tapping, **when** I later open the app, **then** I can still reach OtherWise from a visible entry point (for example, a banner or card on the home screen) during my trip.

---

### US-3: Categories based on my spending

**Priority: Must have**

**As a** traveler with a transaction history, **I want** to see recommended categories that match what I usually buy, **So that** the suggestions are relevant to my life and not generic.

**Acceptance criteria**

1. **Given** I have at least one qualifying transaction category in the past 90 days, **when** I open OtherWise, **then** I see up to 5 categories ranked by my spend or frequency in those categories.
2. **Given** my transactions are classified into the bank's existing category taxonomy, **when** categories are shown, **then** each is displayed with a clear name and icon.
3. **Given** a category has no relevant products for my current country, **when** the screen renders, **then** that category is hidden and not shown empty.
4. **Given** my most recent transactions were in different countries, **when** categories are computed, **then** only the past-purchase categories (not the location of purchase) drive the ranking.

---

### US-4: Product list with price comparison

**Priority: Must have**

**As a** budget traveler, **I want** each category to show a short list of products with how their price compares to my home country, **So that** I can quickly decide what is worth buying here.

**Acceptance criteria**

1. **Given** I am viewing a category, **when** it loads, **then** I see 3 to 5 products, each with a name, short description, typical local price in my home currency, and the difference versus my home country (for example, 22% cheaper).
2. **Given** price data is an estimate, **when** a price is displayed, **then** it is labeled as approximate with the date it was last updated.
3. **Given** products are returned by the API, **when** they are shown, **then** each one is a catalog entry with a validated link.
4. **Given** a product would be more expensive in the current country than at home, **when** products are selected, **then** it is excluded from the list.

---

### US-5: Open a product link

**Priority: Must have**

**As a** traveler, **I want** to tap a product and be taken to where I can find or buy it, **So that** I can act on the recommendation right away.

**Acceptance criteria**

1. **Given** I am viewing a product, **when** I tap it, **then** its link opens in the in-app browser or the default browser.
2. **Given** a product link is unavailable or broken, **when** I tap it, **then** I see a friendly error and can return to the list without losing my place.
3. **Given** I tap a product link, **when** the page opens, **then** the link contains no bank-identifying or personal data in the URL.
4. **Given** I return from the link, **when** I come back to the app, **then** I land on the same category list position.

---

### US-6: Consent and control

**Priority: Must have**

**As a** privacy-conscious user, **I want** to know how my transaction data is used and to turn OtherWise off at any time, **So that** I stay in control of my financial data.

**Acceptance criteria**

1. **Given** I have not yet opted in, **when** I first open the app after the feature launches, **then** I see a clear explanation of what data is used and I can accept or decline.
2. **Given** I decline or withdraw consent, **when** I enter another country, **then** I receive no notification and no transaction data is used for recommendation purposes.
3. **Given** I am on the OtherWise screen, **when** I tap the settings or info control, **then** I can see how recommendations are generated and switch notifications off.
4. **Given** I withdraw consent, **when** the change is saved, **then** it takes effect within 24 hours at the latest, and I see a confirmation.

---

### US-7: Fallback for users with little history

**Priority: Should have**

**As a** new customer or exchange student with a short transaction history, **I want** to still see useful recommendations, **So that** the feature is valuable from the first trip.

**Acceptance criteria**

1. **Given** I have no qualifying transactions in the past 90 days, **when** I open OtherWise, **then** I see a default set of everyday categories (for example, groceries, transport, telecom) for my current country.
2. **Given** the default set is displayed, **when** I view it, **then** it is labeled as general suggestions and not as personalized.
3. **Given** I have fewer than 5 qualifying categories, **when** the screen renders, **then** the remaining slots are filled from the default set without duplicates.

---

### US-8: Feedback on relevance

**Priority: Could have**

**As a** user, **I want** to flag a recommendation as not useful, **So that** I can see better suggestions in future.

**Acceptance criteria**

1. **Given** I am viewing a product or category, **when** I tap a thumbs-down control, **then** the item is hidden for the rest of the trip and my feedback is stored.
2. **Given** I flagged an item, **when** I reopen the screen, **then** it does not reappear.
3. **Given** feedback is stored, **when** the team reviews it, **then** it can be analyzed by category, country and product.

---

### Won't have (this release)

| Item | Reason |
| --- | --- |
| Ads or sponsored products | Out of scope (monetization) |
| Receipt scanning and rewards | Out of scope |
| Popularity-based recommendations | Out of scope |
| In-app checkout | Out of scope; external links only |

---

## 5. Functional Requirements

**Location and trip detection**

1. FR-1: The system shall determine the user's current country using a defined signal (see Open Questions) and compare it with the user's home country stored in their bank profile.
2. FR-2: The system shall treat a trip as started when the detected country differs from the home country and no active trip exists for that country.
3. FR-3: The system shall limit OtherWise notifications to one per country per trip.
4. FR-4: The system shall only enable OtherWise for users whose home country is an E.U. member state, and only while they are in another E.U. member state.

**Notification**

5. FR-5: The app shall send a push notification, with a title and short body referencing the destination country, to eligible opted-in users.
6. FR-6: Tapping the notification shall deep-link to the OtherWise screen for that country.
7. FR-7: The app shall provide a persistent entry point to OtherWise on the home screen during an active trip.

**Personalization**

8. FR-8: The system shall derive up to 5 top categories per user from the past 90 days of transaction data, using the bank's existing category taxonomy.
9. FR-9: Category ranking shall be based on spend and transaction frequency.
10. FR-10: The system shall fall back to a default set of everyday categories when the user has insufficient history.

**Product recommendations (API)**

11. FR-11: For each category, the system shall call the product and price API with the category and country pair and receive 3 to 5 products from the curated catalog for the destination country.
12. FR-12: The API shall rank products deterministically by price saving versus the home country, with destination-exclusive products labeled separately.
13. FR-13: Each product shall show name, description, approximate price in the user's home currency, and a price comparison against the home country or an exclusivity label.
14. FR-14: Only products that are cheaper than at home, or exclusive to the destination, shall be shown.
15. FR-15: API requests shall contain only category identifiers and the country pair; they shall not contain account numbers, names, merchant names, amounts or other personal data.
16. FR-16: API responses shall be cached per country pair and category to reduce latency and load.
17. FR-17: The system shall serve a static, curated list if the API call fails or times out.

**Product links**

18. FR-18: Tapping a product shall open its external link in an in-app or external browser.
19. FR-19: Links shall be checked for validity as part of catalog maintenance.

**Consent and settings**

20. FR-20: The app shall request explicit opt-in before OtherWise uses transaction data or sends notifications.
21. FR-21: Users shall be able to withdraw consent and disable notifications from within the feature.
22. FR-22: The OtherWise screen shall include a short disclosure that prices are approximate and that suggestions are not financial advice.

**Analytics**

23. FR-23: The system shall log events for notification sent, opened, categories viewed, product tapped, opt-in, opt-out and feedback, without personal financial data.

---

## 6. Non-Functional Requirements

### Performance

- The OtherWise screen shall render categories in under 2 seconds at p95 on a standard mobile connection, using cached results.
- Uncached API responses shall return in under 2 seconds at p95, with a fallback after a 3-second timeout.
- Notification shall be delivered within 5 minutes of country detection.

### Accessibility

- Conform to WCAG 2.1 AA.
- All interactive elements shall have accessible labels for screen readers, and touch targets of at least 44×44 px.
- Do not rely on color alone to indicate cheaper or exclusive; use text labels.
- Support dynamic text sizing and dark mode if the app supports it.
- Provide the copy in the app's supported languages, because users are traveling and may not read the local language.

### Security and Privacy

- GDPR compliance: lawful basis (explicit consent), data minimization, purpose limitation and the right to withdraw.
- No personal or identifiable data shall be sent to the product and price API (see FR-15).
- Deep links shall require authentication before showing any user-specific content.
- Outbound product links shall contain no user identifiers.
- If the API is operated by a third party, confirm a data-processing agreement is in place.
- Log access to transaction data used for personalization and retain it per the bank's policy.

### Scalability

- Support the full eligible user base traveling at peak times (for example, summer holidays or semester starts) without degradation.
- Because results are cached per country pair and category, API calls scale with the number of distinct pairs and categories, not with the number of users.
- Notification sending shall be queued and rate-limited to avoid spikes.
- The catalog shall be extensible to new E.U. countries and categories without code changes.

### Reliability

- The feature shall degrade gracefully (static fallback) if the API or catalog service is unavailable, and shall never block core banking functions.

---

## 8. Open Questions and Dependencies

### Open Questions

| # | Question | Decision |
| --- | --- | --- |
| 1 | What signal defines arrival? | Device GPS; if location is off, the first card transaction abroad defines arrival. |
| 2 | Where does the price data come from? | Mock data for the MVP. |
| 3 | How are products selected? | The product and price API queries a prebuilt catalog built from scraped data that goes through preprocessing. |
| 4 | Who curates and maintains product links, and how often are they validated? | A validation pipeline with gates and filters. |
| 5 | Is consent for using transaction data covered by existing T&Cs, or is a new explicit opt-in required under GDPR? | Existing T&Cs. |
| 6 | Can transaction category data be sent to the API in aggregate form, and in which regions must it be processed? | Yes, in aggregate form, processed in the region where the payment is made. |
| 7 | How is the user's home country defined? | Country of residence (must be an E.U. member state, see Section 3). |
| 8 | Should prices be shown in the home currency, local currency, or both? | Home currency by default; users can switch. |
| 9 | Which languages must the feature support at launch? | English, Spanish, German. |
| 10 | Should foreign workers living abroad long-term stop receiving notifications after a time limit? | No. |

### Dependencies

- **Banking app:** push notification infrastructure and deep-linking.
- **Transaction data service:** access to categorized transactions for the past 90 days.
- **User profile service:** reliable country-of-residence field.
- **Location signal:** per Open Question 1.
- **Product and price API:** endpoint access, rate limits and uptime.
- **Product and price catalog:** curated dataset per E.U. country pair and category.
- **Legal and compliance:** consent text and DPIA sign-off.
- **Analytics:** event tracking and dashboards.
- **Design:** screens for notification, category list, product list, consent and settings.

### Scope risk (16-hour constraint)

The 16-hour budget is tight for the full loop. Recommended approach: back the API with a pre-generated mock catalog for a small set of E.U. country pairs and categories, build US-1 to US-6 first, and treat US-7 and US-8 as stretch items. Consent (US-6) should not be cut.

---

## 9. Edge Cases to Define Before Development

**Location and trips**

1. **Border regions and short trips:** user commutes daily across a border, or makes a day trip. Should a notification still fire? Yes.
2. **Transit and layovers:** user lands for a connection or drives through a country. Do we notify? Yes.
3. **Multi-country trips:** user visits three countries in a week. One notification per country, or a cap per day? One notification per country.
4. **Inaccurate or spoofed location:** VPN use, disabled location services, or location permission denied. The app blocks access with VPN and spoofed locations. Disabled location services or denied permission do not affect recommendations; after the first purchase outside the home country, a popup notification appears with recommendations.
5. **Long-term stays:** exchange students and foreign workers who live abroad for months. They only get a notification once; afterwards they reach OtherWise through its tab in the app.
6. **Returning home:** what happens to an active trip, entry point and cached data? The data stays cached.
7. **Home country equals destination or dual residence:** if the home country equals the destination, no notification is sent. Users select a single country of residence in their profile, so dual residence does not occur.

**Notification**

8. **Push permission off:** how does the user discover the feature (in-app entry point only)?
9. **Notification received at night or while roaming with data off:** quiet hours and delayed delivery.
10. **Tapping an old notification** after leaving the country: show content for the original country or the current one?

**Personalization**

11. **No transaction history,** or only transactions in sensitive categories (for example, health, gambling, adult content, political or religious donations). Define an exclusion list of categories that are never used or shown.
12. **Shared or joint accounts:** whose spending drives categories?
13. **Dominant but non-actionable categories,** such as rent or insurance, which have no relevant products to compare. Filter them out.
14. **Fewer categories than the minimum** after filtering: apply fallback.

**Recommendations and prices**

15. **No product is cheaper** in a given category for this country pair: hide the category or show a message.
16. **Same currency vs. different currency:** price differences driven by exchange rate swings; define how often rates are refreshed.
17. **Stale price data:** define a maximum age after which prices are hidden or flagged.
18. **API response invalid,** empty, duplicated or missing required fields: discard and fall back.
19. **API timeout or outage:** show cached or static list.
20. **Prices that differ by city or region** within a country, or by store chain.
21. **Products with legal restrictions** (alcohol, tobacco, medication, age-restricted goods): exclude or add age and legality notes, and define whether they appear at all.
22. **Products that cannot be brought home** (customs and import limits): add a disclosure or exclude.

**Links**

23. **Broken, region-blocked or redirected links,** and links that open in a language the user cannot read.
24. **Link targets that become unsafe** or change content: need a validation and takedown process.

**Consent, privacy and compliance**

25. **Consent withdrawn mid-trip:** immediate stop of notifications and removal of cached personalized data.
26. **Minors or accounts with restricted consent:** eligibility rules.
27. **User deletes their account** or requests data erasure while a trip is active.

**Technical and UX**

28. **App not updated:** older versions that cannot render the screen or deep link.
29. **Offline or poor connectivity abroad:** show cached content or a retry state.
30. **Accessibility and language:** right-to-left or long strings, and users whose device language differs from the destination language.
