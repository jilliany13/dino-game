import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Adaptive Dino Runner',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
