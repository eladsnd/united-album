import "./globals.css";

export const metadata = {
    title: "United Album - Wedding Pose Challenge",
    description: "Capture the perfect wedding moments",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
