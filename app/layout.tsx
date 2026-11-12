import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import './globals.css';
import './motor.css';
import './admin.css';
import './responsive.css';
export const metadata: Metadata = { icons: { icon: '/icon.svg' }, title: 'Car-Fit24 | Kostenlose Autoabholung Hamburg', description: 'Ihr Auto steht? Wir bringen Bewegung rein. Kostenlose Abholung nicht fahrbereiter Fahrzeuge in Hamburg und Umgebung nach Bestätigung durch Sofiane.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="de"><body>{children}</body></html>}
