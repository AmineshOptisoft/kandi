import { Outfit } from 'next/font/google';
import './globals.css';
import "flatpickr/dist/flatpickr.css";
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import Script from 'next/script';

const outfit = Outfit({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" defer />
        <Script id="onesignal-init" strategy="afterInteractive">
          {`
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function (OneSignal) {
              const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.");
              if (isLocal) {
                console.log("OneSignal skipped on local development to prevent origin errors.");
                return;
              }
              try {
                await OneSignal.init({
                  appId: "c725be3b-b497-4e32-a6d6-9d8ed6420dd4",
                  safari_web_id: "web.onesignal.auto.257d0569-0e14-4d06-8d17-3d55d768ff68",
                  notifyButton: {
                    enable: true,
                  },
                  serviceWorkerPath: "OneSignalSDKWorker.js",
                  serviceWorkerParam: { scope: "/" },
                  allowLocalhostAsSecureOrigin: true,
                });
              } catch (e) {
                console.warn("OneSignal init error:", e);
              }
            });
          `}
        </Script>
        <AuthProvider>
          <ThemeProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
