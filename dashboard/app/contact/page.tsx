import Link from "next/link";
import Logo from "../Logo";
import { BRAND, CONTACT_EMAIL } from "../legal";
import CopyEmail from "./CopyEmail";
import "../legal.css";

export const metadata = { title: `Contact - ${BRAND}` };

export default function Contact() {
  return (
    <main className="legal">
      <Link href="/" className="back"><Logo size={24} />{BRAND}</Link>
      <h1>Contact us</h1>
      <p className="updated">Questions, problems or ideas? We read every message.</p>
      <p>Write to us at:</p>
      <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{CONTACT_EMAIL}</p>
      <CopyEmail email={CONTACT_EMAIL} />
      <p style={{ marginTop: 24 }}>Already have an account? Open your <Link href="/dashboard">dashboard</Link> and use <b>Send feedback</b> in the left menu.</p>
    </main>
  );
}
