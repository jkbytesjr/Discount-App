# App Store submission: privacy and age rating

Answers for App Store Connect. They describe what the app and the API actually do today; re-check them before every submission.

## 1. Privacy Policy URL

`https://discount-app-rho.vercel.app/privacy` (live, HTTPS, Portuguese and English: `?lang=pt` / `?lang=en`). Enter it under App Information → Privacy Policy URL. The app also links to it from Profile and from the sign-in/register screens. The contact address on the page comes from `PRIVACY_CONTACT_EMAIL` (default `jkbytesjr@gmail.com`): replace it with a monitored support address before submitting.

Apple also requires an in-app way to delete the account: Profile → Delete account (data is anonymised).

## 2. App Privacy labels ("nutrition labels")

Third-party SDKs: none. The iOS app uses only Apple frameworks (SwiftUI, MapKit, CoreLocation, UserNotifications, LocalAuthentication). No analytics, advertising or crash-reporting SDK. Hosting (Vercel), database (Neon) and email (Gmail) are server-side processors, not SDKs.

**Does the app collect data? Yes. Does it track users? No** (no data is linked with third-party data for advertising, and nothing is shared with data brokers). Select "No" for tracking; no ATT prompt is needed.

| Apple data type | Collected | Linked to the user | Used for | Notes |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | App Functionality | account first and last name |
| Contact Info → Email Address | Yes | Yes | App Functionality | sign-in, confirmation, password reset, security notices |
| Contact Info → Phone Number | Yes (optional) | Yes | App Functionality | profile field |
| Location → Coarse Location | Yes | Yes | App Functionality | alert events carry the position rounded to about 100 m; nearby-offer requests send current coordinates. Precise location is processed on the device only |
| Identifiers → User ID | Yes | Yes | App Functionality | account id |
| Identifiers → Device ID | Yes (if notifications allowed) | Yes | App Functionality | APNs push token |
| User Content → Other User Content | Yes | Yes | App Functionality | favourites and the cards/wallets chosen (product only) |
| Usage Data → Product Interaction | Yes | Yes | App Functionality | alert history (type, place, discount, time) |
| Other Data Types | Yes | Yes | App Functionality | alert preferences |

Not collected: Financial Info (no card number, expiry, CVV or last four digits are ever stored; card products are a catalogue choice), Health & Fitness, Sensitive Info, Contacts, Browsing History, Search History, Purchases, Diagnostics, Photos, Audio, Precise Location.

## 3. Age rating questionnaire

Expected result: **4+**. Answer every content question "None": cartoon or fantasy violence, realistic violence, prolonged graphic violence, sexual content or nudity, profanity or crude humour, horror or fear themes, alcohol/tobacco/drug references, medical or treatment information, gambling and contests. Capabilities: unrestricted web access **No**; user-generated content **No** (businesses publish offers through the web portal, not the iOS app; customers cannot post); messaging or chat **No**; advertising **No**; parental controls **No**; age assurance **No**. Gambling (simulated or real) **No**. The privacy policy states the service is not intended for under 16.

## 4. Other submission items

- Export compliance: the app uses only HTTPS/system encryption → "Uses standard encryption" exemption.
- Sign-in with Apple is not required (no third-party social login).
- Review notes: provide a customer demo account (not listed in the repo) and say the business and admin roles use the web portal. Location "Always" is optional; the app explains why before asking.
- Local alerts work without push; APNs needs the Apple Developer Program key.
