import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'USPS - United States Postal Service',
  description: 'Welcome to USPS.com. Track packages, pay and print postage, schedule free package pickups, and find everything you need for sending mail and shipping packages.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
