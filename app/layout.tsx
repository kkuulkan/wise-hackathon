import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono, DM_Sans } from "next/font/google";

import { Cover } from "@/components/Cover";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

// The wdth axis gives the expanded field labels a passport form sets.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OtherWise",
  description:
    "Spots the things you already buy that cost less where you are right now.",
};

export const viewport: Viewport = {
  themeColor: "#0f2c5c",
  width: "device-width",
  initialScale: 1,
};

/*
 * Runs before the page paints: marks the document as animated and locks
 * scrolling so the cover is shut on arrival. Reduced motion skips both, which
 * means the cover never appears and nothing is ever locked.
 */
const PREPAINT = `(function(){var r=document.documentElement;
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
r.classList.add('anim','locked');
/* If the cover never mounts, hydration failed: drop the cover and the lock
   rather than leaving the page sealed shut and unscrollable. */
setTimeout(function(){if(!r.hasAttribute('data-cover-ready'))r.classList.remove('anim','locked')},4000)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${dmSans.variable} ${dmMono.variable}`}
      /*
       * PREPAINT adds `anim` and `locked` to this element before React
       * hydrates, and Lenis adds its own classes after, so the class list here
       * legitimately differs between server and client. Scoped to <html>: it
       * does not suppress warnings anywhere else in the tree.
       */
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
        <SmoothScroll />
        <Cover />
        <div className="sheet">{children}</div>
      </body>
    </html>
  );
}
