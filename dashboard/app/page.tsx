import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1>Chatbot Platform</h1>
      <p>Add an AI chatbot to your website in minutes. It answers your customers using your own business information.</p>
      <div className="row">
        <Link className="btn" href="/sign-up">Get started</Link>
        <Link className="btn secondary" href="/sign-in">Sign in</Link>
      </div>
    </main>
  );
}
