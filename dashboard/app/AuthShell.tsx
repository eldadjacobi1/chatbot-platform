import Logo from "./Logo";
import "./auth.css";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <section className="auth-side">
        <div className="auth-brand"><Logo size={34} />Chattr</div>
        <div>
          <h1>Customers ask. Your website answers.</h1>
          <ul>
            <li>Answers from your own business info</li>
            <li>Works day and night, even when you&apos;re closed</li>
            <li>Collects leads when it can&apos;t help</li>
          </ul>
        </div>
        <p className="auth-fine">Free plan. No credit card.</p>
      </section>
      <section className="auth-form">{children}</section>
    </main>
  );
}
