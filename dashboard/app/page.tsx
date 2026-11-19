import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <nav className="nav">
        <span className="brand">Chatbot Platform</span>
        <Link className="btn secondary" href="/sign-in">Sign in</Link>
      </nav>

      <section className="hero">
        <div>
          <h1>Answer customers while you&apos;re busy.</h1>
          <p className="lead">
            Add a chatbot to your website in minutes. It answers using your own business information.
          </p>
          <Link className="btn" href="/sign-up">Get started free</Link>
        </div>

        <div className="demo" aria-label="Example conversation">
          <div className="who">Big Apple Plumbing</div>
          <div className="bubble bot">Hi! How can I help you today?</div>
          <div className="bubble you">Are you open on Saturday?</div>
          <div className="bubble bot">Yes, we&apos;re open Saturday from 9 AM to 2 PM. Call us to book a visit.</div>
        </div>
      </section>

      <section className="points">
        <div>
          <h3>Your information, your answers</h3>
          <p>The bot only answers from what you write. No made-up prices or hours.</p>
        </div>
        <div>
          <h3>See what customers ask</h3>
          <p>Your dashboard shows the most asked questions, and the ones the bot couldn&apos;t answer.</p>
        </div>
        <div>
          <h3>Costs stay low</h3>
          <p>Repeated questions are answered for free, and limits stop abuse.</p>
        </div>
      </section>
    </main>
  );
}
