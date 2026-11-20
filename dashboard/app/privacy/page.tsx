import Link from "next/link";
import Logo from "../Logo";
import { BRAND, CONTACT_EMAIL, LEGAL_UPDATED } from "../legal";
import "../legal.css";

export const metadata = { title: `Privacy policy - ${BRAND}` };

export default function Privacy() {
  return (
    <main className="legal">
      <Link href="/" className="back"><Logo size={24} />{BRAND}</Link>
      <h1>Privacy policy</h1>
      <p className="updated">Last updated {LEGAL_UPDATED}</p>

      <p>{BRAND} lets a business add a chat assistant to its website. This page explains what information we handle and why. Questions? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

      <h2>Who is who</h2>
      <p>The business that adds the chat to its website (the &ldquo;owner&rdquo;) decides what the assistant knows and what it is used for. People who chat with the assistant are &ldquo;visitors&rdquo;. We run the service for owners.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>From owners:</b> email address and sign-in details, the business information you enter, your chat settings, and your subscription status.</li>
        <li><b>From visitors:</b> the questions they type into the chat, and the name, email or phone number they choose to leave when they ask to be contacted.</li>
        <li><b>Technical data:</b> IP address and a session token, used to prevent abuse and enforce limits, and usage counts such as the number of messages and AI tokens used.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To answer visitors&rsquo; questions using the owner&rsquo;s business information.</li>
        <li>To show owners reports: most asked questions, questions the assistant could not answer, and leads.</li>
        <li>To keep the service secure, apply limits and prevent abuse.</li>
        <li>To bill paid plans and to contact you about your account.</li>
      </ul>
      <p>We do not sell personal information and we do not use chat content to show ads.</p>

      <h2>Services we rely on</h2>
      <p>To run {BRAND}, information is processed by these providers: OpenAI (generates the assistant&rsquo;s answers from the visitor&rsquo;s question and the owner&rsquo;s business information), Clerk (sign-in), Stripe (payments; we never see full card numbers), Cloudflare Turnstile (checks that a visitor is a real person), and Vercel and Railway (hosting).</p>

      <h2>Visitors</h2>
      <p>Visitors should not type sensitive information into the chat, such as payment card numbers or health details. The assistant is automated, and what visitors type is shared with the business and processed by the providers above. Contact details are shared only when a visitor chooses to send them, and they go to the business.</p>

      <h2>How long we keep it</h2>
      <p>We keep owner and chat data while an account is active. Owners can delete individual leads in the dashboard. When an account is closed, we delete its data within a reasonable time unless the law requires us to keep something.</p>

      <h2>Your choices</h2>
      <p>You can ask us to access, correct or delete your information by writing to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If you are a visitor, you may also contact the business that runs the chat on its website.</p>

      <h2>Cookies</h2>
      <p>We use only the cookies needed to sign owners in and keep the service secure. We do not use advertising cookies.</p>

      <h2>Changes</h2>
      <p>If we make important changes to this policy, we will update the date above and tell account owners.</p>
    </main>
  );
}
