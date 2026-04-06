# Rider WebView Application — Product & Architecture Specification

**Document Version:** 1.0  
**Status:** Draft / Review  
**Target Architecture:** Native WebView Wrapper (Android / iOS) loading the Next.js/React Frontend

---

## 1. Executive Overview

### 1.1 Purpose
The Rider WebView Application was initially developed as a testing wrapper to validate the web-based rider dashboard and backend services. The purpose of this specification is to elevate this initial prototype into a fully optimized, production-ready mobile application. This app provides logistics/ride-hailing drivers (riders) with a unified, native-like interface to view ride requests, manage their online/offline status, update profiles, and manage trip lifecycles.

### 1.2 Target Audience
*   **Primary Users:** Onboarded Riders / Drivers.
*   **Operating Context:** Frequently moving, potentially varying network conditions (3G/4G/5G/Offline), varying lighting conditions (day/night driving).

---

## 2. UI/UX Specifications

To ensure the WebView app feels native, the responsive web interface must adhere to mobile-first design principles, maximizing tap targets and minimizing cognitive load.

### 2.1 Thematic & Visual Identity
*   **Design Paradigm:** Modern, distraction-free, high-contrast.
*   **Color Palette:**
    *   **Primary Brand Color:** Deep Blue (`#1E3A8A`) or equivalent brand accent.
    *   **Success Alerts (Ride Accepted/Online):** Emerald Green (`#10B981`).
    *   **Warning/Alerts:** Amber (`#F59E0B`).
    *   **Error/Reject (Offline):** Rose Red (`#EF4444`).
    *   **Backgrounds:** Light theme (`#F8FAFC`) / Dark mode ready (`#0F172A`) for night-time driving.
*   **Typography:** Highly legible sans-serif fonts (e.g., *Inter*, *Roboto*, or *SF Pro*). Minimum readable size of `16px` for dynamic scaling, larger metrics for critical ride data.

### 2.2 Layout Constraints
*   **Header & Safe Areas:** Padding applied dynamically based on device safe-area insets (`env(safe-area-inset-top)`) to prevent notch or dynamic island overlaps.
*   **Navigation:** Persistent bottom navigation bar for quick access (Dashboard, Earnings, Profile, Settings) without relying on browser navigation.
*   **Interaction Feedback:** Touch ripples or active state color alterations applied to all interactive buttons to confirm physical interaction.

---

## 3. Core WebView Setup & Configuration

The native wrapper (e.g., Android `WebView`, iOS `WKWebView`, or Capacitor) must be configured correctly to offer a seamless bridge between web APIs and device hardware.

### 3.1 Initial Setup
*   **Base URL:** Pointing to the production URL path.
*   **User-Agent Injection:** Custom User-Agent string appended (e.g., `AppName/1.0 (Rider-WebView; Android 14)`) to allow the backend/frontend to conditionally render native-specific components and hide generic web elements.

### 3.2 Web Settings & Environment
*   **JavaScript:** Enabled for full application logic execution.
*   **DOM Storage:** Enabled for retaining offline queue states, session tokens, and local cache.
*   **Cache Mode:** `LOAD_DEFAULT` initially, falling back to network cache dynamically if the network drops.
*   **Media Playback:** Configured to allow automated notification chimes for incoming tasks without strict user gesture requirements.
*   **Zooming/Scaling:** Disable pinch-to-zoom and double-tap zoom to restrict the UI layout shifting. Layout scaling fully delegated to CSS `viewport` meta tag.

---

## 4. Fundamental App Features

### 4.1 Authentication & Session Management
*   **Secure Login Flow:** Access via registered credentials or OTP magic links.
*   **Persistent Sessions:** Securely storing JWT / Session IDs via local storage or secure cookies, injected via the native bridge safely.
*   **Auto-Login/Biometrics (Upgrade):** Implement bridge to iOS FaceID / Android BiometricPrompt.

### 4.2 Dashboard & Active Status Control
*   **Condition Dropdown / Toggle:** Sticky "Go Online / Go Offline" toggle in the navigational header. Updates real-time presence via WebSocket/API without requiring page reloads or user logouts.
*   **Live Earnings Summary:** Top-level metrics of today's trips and earnings.

### 4.3 Order & Ride Management
*   **Task Lists:** Segregated tabs for *Pending Requests*, *Active Trip*, and *Completed History*.
*   **Trip Interaction:** Large, easily accessible swipe-to-accept or tap-and-hold buttons to prevent accidental clicks while driving.
*   **Turn-by-turn Navigation:** Deep linking via URI schemas to native `google.navigation:q=` or Apple Maps when the rider selects "Navigate to Pickup."

### 4.4 Profile & Settings
*   **Vehicle & Account Management:** Ability to update vehicle documents (insurance, driving license), which relies on File Chooser intents natively.
*   **Notification Preferences:** Configure granularity of alerts and sounds.

---

## 5. Native Integration & Bridge Capabilities

To escape the limitations of a standard browser tab, specific native bridges must be established.

### 5.1 Native UI Overlays
*   **Splash Screen:** A zero-lag native splash screen matching the app's brand colors. Held actively until the WebView emits a page load complete event to prevent white-screen flashing.
*   **Loaders/Spinners:** Inject native progress bars during heavy HTTP requests if the React app takes too long to hydrate.
*   **Hardware Back Button Navigation (Android):** Intercept the physical back button. If the web history has previous stacks, navigate web history. If at the root dashboard, double-tap to exit the application gracefully.

### 5.2 Offline & Network Handling
*   **Network Listener:** Native broadcast receiver monitoring network stability. Sends event to the WebView JS indicating network status.
*   **Offline UI:** A persistent top banner or modal "No Internet Connection - Retrying..." overlays the app until network restores.

### 5.3 Location & Background Tracking (Crucial)
*   **Requirement:** Standard web Geolocation API stops functioning when the app is backgrounded.
*   **Solution:** Implement a Native Background Location Service. The native layer captures real-time coordinates every `x` seconds and forwards them to the Node.js backend directly, allowing real-time Rider polling even if the WebView goes idle.

---

## 6. Permissions & Security

### 6.1 Required OS Permissions
*   **Android / iOS Manifests:**
    1.  `LOCATION` (Foreground & Background Tracking).
    2.  `CAMERA` & `STORAGE` (Profile and document uploads).
    3.  `NOTIFICATIONS` (Ride request push notifications).
    4.  `INTERNET` & `NETWORK_STATE`.

### 6.2 Security Posture
*   **SSL/TLS Only:** Cleartext traffic disabled. All WebView payloads strictly enforced over HTTPS.
*   **Content Restrictions:** Ensure any link external to the required domains is pushed to the system's external web browser, preventing phishing within the Rider app wrapper.

---

## 7. Performance & Optimization Strategy

*   **Asset Preloading:** Implement React service workers to cache structural CSS, fonts, and brand images offline, resulting in near-instant render times on subsequent app launches.
*   **Image Optimization:** Avatar and map placeholders delivered in highly compressed WebP formats.
*   **Memory Management:** Hook into OS-level memory warnings. Notify the WebView to flush caches and garbage-collect non-essential DOM elements if the device struggles.
*   **FastClick & Tap Delay:** Ensure standard web 300ms tap bounds are mitigated natively via the viewport tag.

---

## 8. Deployment & Release Build

### 8.1 Android
*   **Format:** Android App Bundle (`.aab`) configured for dynamic delivery, optimizing final binary size.
*   **Version Alignment:** Increment native version codes automatically, aligning logically with major web-deployment milestones.

### 8.2 iOS
*   **Format:** Standard `.ipa` package via Xcode App Store Connect.
*   **App Store Review Readiness:** iOS specifically requires WebView-heavy applications to feel indistinguishable from native apps. Make sure native push notifications (APNs) and smooth native transitions are locked in.

### 8.3 Asset & Branding
*   **App Icons:** Adaptive icons provided for all density buckets (Android) and complete grid for iOS.
*   **Google Play Feature Graphic:** High-resolution banner (`1024x500`) for the store listing.

---

## 9. Improvements & Recommendations

1.  **Migrate to Capacitor or React Native:** While a pure custom WebView wrapper is a great start, standardizing on Capacitor.js or React Native will provide robust, out-of-the-box plugin access to background geolocations and push notifications over writing custom code.
2.  **Telemetry & Crash Reporting:** Implement Sentry or Firebase Crashlytics on the native layer to catch runtime exceptions (e.g., OutOfMemory on WebView) separately from your web-frontend boundary errors.
3.  **UI Code Audit:** Confirm that the front-end has entirely abstracted out hover-states (`:hover`), as mobile platforms treat hover as sticky inputs which degrade the app's tactile feel. Replace with explicit `:active` state visual feedback.

---

## 10. React Native Developer Handoff – Exact UI/UX Specs

If the application is being migrated natively using **React Native/Expo** via an AI Agent or mobile engineer, use the exact style dictionaries below extracted from the frontend repository to maintain 1:1 design parity.

### 10.1 Global Color System (Tailwind Equivalents)
```json
// Define these in your native theme configuration
{
  "brand": {
    "50": "#eff6ff",
    "100": "#dbeafe",
    "400": "#60a5fa",
    "500": "#3b82f6", // Primary Buttons & Active states
    "600": "#2563eb", // Hover/Pressed Action states
    "700": "#1d4ed8",
    "900": "#1e3a8a"  // Login Gradient Dark
  },
  "background": {
    "light": "#f9fafb", // gray-50 - Main Screen Background
    "dark": "#030712",  // gray-950 - Dark Mode Background
    "cardLight": "#ffffff",
    "cardDark": "#111827", // gray-900
    "borderLight": "#e5e7eb", // gray-200
    "borderDark": "#1f2937"   // gray-800
  },
  "status": {
    "green": "#22c55e", // Go Online Button / Complete
    "red": "#ef4444",   // Go Offline Button / Cancelled
    "indigo": "#4f46e5" // Ride Started Ribbon
  },
  "text": {
    "primary": "#1f2937",   // gray-800
    "secondary": "#6b7280", // gray-500
    "tertiary": "#9ca3af",  // gray-400
    "white": "#ffffff"
  }
}
```

### 10.2 Typography Specs
*   **Font Family:** Highly legible system default (`System` in React Native mapping to **SF Pro** on iOS, **Roboto** on Android) or explicitly `Outfit`/`Inter` if custom fonts are loaded.
*   **Font Sizes & Weights:**
    *   **Main Headings (Ride Status, Totals):** `fontSize: 24` or `36` (`text-3xl`/`text-4xl`), `fontWeight: '800'` (`extrabold`).
    *   **Titles (Card Titles, Navigation):** `fontSize: 18` (`text-lg`), `fontWeight: '700'` (`bold`).
    *   **Standard Text:** `fontSize: 14` (`text-sm`), `fontWeight: '500'`.
    *   **Subtitles/Meta:** `fontSize: 12` (`text-xs`), `fontWeight: '400'`, `color: theme.text.tertiary`.

### 10.3 Native Component Layout Equivalents

#### 1. Sticky Top Header (Dashboard Top Bar)
*   **Structure:** `<View>` container spanning 100% width.
*   **Styling:**
    *   `height: ~60` (plus Safe Area top inset)
    *   `backgroundColor: theme.background.cardLight`
    *   `borderBottomWidth: 1`, `borderColor: theme.background.borderLight`
    *   `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`
    *   `paddingHorizontal: 16`
*   **Elements:** User Avatar (`borderRadius: 9999`, size 40x40), Status Texts, and Online/Offline Toggle button (`borderRadius: 8`, `paddingVertical: 6`, `paddingHorizontal: 16`).

#### 2. Statistical Gradient Banner (Earnings Row)
*   **Structure:** Use `react-native-linear-gradient`.
*   **Styling:**
    *   `colors={['#2563eb', '#1d4ed8']}` (brand-600 to brand-800)
    *   `flexDirection: 'row'`, `justifyContent: 'space-around'`, `padding: 16`
*   **Text inside:** White color, main stat `fontSize: 20, fontWeight: '800'`, label `fontSize: 12, opacity: 0.7`.

#### 3. Main Navigation View (Tabs)
*(Note: In the web version these sit below the header as top-tabs, but for React Native, shift these to a standard Bottom Tab Navigator `createBottomTabNavigator` for true native feel!)*
*   **Tabs:** Rides, Orders, Trips, Profile.
*   **Active Tab Styling (If top-tab):**
    *   `borderBottomWidth: 2`, `borderBottomColor: theme.brand.500`
    *   `color: theme.brand.600`, `fontWeight: '600'`
*   **Inactive Tab Styling:** `borderBottomColor: 'transparent'`, `color: theme.text.secondary`.

#### 4. Card Surfaces (Ride Requests / Order History)
*   **Styling:**
    *   `backgroundColor: theme.background.cardLight`
    *   `borderRadius: 16` (`rounded-2xl`)
    *   `borderWidth: 1`, `borderColor: theme.background.borderLight`
    *   `overflow: 'hidden'`
    *   Shadows (iOS): `shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4`
    *   Elevation (Android): `elevation: 1`
    *   `marginBottom: 16`

#### 5. Buttons & Inputs
*   **Primary Button:**
    *   `backgroundColor: theme.brand.500`
    *   `borderRadius: 12` (`rounded-xl`)
    *   `paddingVertical: 12`
    *   Text: `color: 'white', fontWeight: 'bold', fontSize: 14, textAlign: 'center'`
*   **Forms/Inputs:**
    *   `borderWidth: 1`, `borderColor: theme.background.borderLight`
    *   `borderRadius: 12`
    *   `padding: 12`
    *   `backgroundColor: theme.background.cardLight`

*(Provide this section exactly as written to any Native Dev or AI system to re-generate the React Native UI effortlessly.)*
