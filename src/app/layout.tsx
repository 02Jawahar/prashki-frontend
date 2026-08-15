import type { Metadata } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import '@/styles/globals.css'

const displaySerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-display-serif',
  display: 'swap',
})

const bodySans = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Prash & Ki — New Era of Crafted Couture',
    template: '%s | Prash & Ki',
  },
  description:
    'Hand-finished couture, cut to order in our studio. Dresses, kurta sets, co-ords, sarees and accessories.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displaySerif.variable} ${bodySans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
