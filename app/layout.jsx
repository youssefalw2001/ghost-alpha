import './globals.css';

export const metadata = {
  title: 'Ghost Alpha',
  description: 'Private crypto opportunity scanner',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
