import Link from "next/link";
import Logo from "../Logo";
import { BRAND, CONTACT_EMAIL, LEGAL_UPDATED } from "../legal";
import "../legal.css";

export const metadata = { title: `Terms of service - ${BRAND}` };

export default function Terms() {
  return (
    <main className="legal">
      <Link href="/" className="back"><Logo size={24} />{BRAND}</Link>
      <h1>Terms of service</h1>
      <p className="updated">Last updated {LEGAL_UPDATED}</p>

      <p>By creating an account or using {BRAND}, you agree to these terms. If you use it for a business, you confirm you can accept them for that business.</p>

      <h2>The service</h2>
      <p>{BRAND} provides a chat assistant that a business can add to its website. The assistant answers questions using only the information the owner provides, and can collect contact details from visitors who ask to be contacted. It does not book appointments or take payments.</p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>You are responsible for the business information you enter and for keeping it accurate and up to date.</li>
        <li>You must have the right to use that information and to add the chat to your website.</li>
        <li>You are responsible for following the laws that apply to your business, including telling your visitors that they are chatting with an automated assistant and how their information is used.</li>
        <li>Do not use the service for anything illegal, harmful, misleading or abusive, and do not try to break, overload or bypass its limits.</li>
      </ul>

      <h2>AI answers</h2>
      <p>The assistant is automated and can make mistakes. Do not rely on it for legal, medical, financial or emergency advice. Check its answers regularly, and keep your business information current.</p>

      <h2>Plans, limits and billing</h2>
      <p>The Free, Pro and Business plans have different limits, such as the number of chatbots and messages per day. Paid plans are billed monthly through Stripe and renew until you cancel. You can cancel at any time and keep access until the end of the period you paid for. We may change prices or limits with advance notice.</p>

      <h2>Your data</h2>
      <p>You keep ownership of your business information and your leads. You give us permission to process them to run the service, as described in our <Link href="/privacy">privacy policy</Link>.</p>

      <h2>Availability</h2>
      <p>We work to keep {BRAND} running, but we do not promise it will always be available or error-free. We may change or stop features, and we may suspend accounts that break these terms.</p>

      <h2>Liability</h2>
      <p>The service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect or lost-profit damages, and our total liability is limited to what you paid us in the 12 months before the claim.</p>

      <h2>Contact</h2>
      <p>Questions about these terms? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </main>
  );
}
