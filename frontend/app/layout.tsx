import AuthInitializer from "@/components/auth-intializer";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import "react-big-calendar/lib/css/react-big-calendar.css";

export const metadata = {
  title: "OG Vision AR",
  description: "Eyewear Virtual Try-On System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* <link rel="stylesheet" href="/bootstrap.css" /> */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}