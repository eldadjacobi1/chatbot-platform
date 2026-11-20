"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

// Sign in / Get started, or a Dashboard link when the visitor is already logged in.
export default function NavActions() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) {
    return <Link className="lp-btn" href="/dashboard">Open dashboard</Link>;
  }
  return (
    <>
      <Link className="lp-link" href="/sign-in">Sign in</Link>
      <Link className="lp-btn" href="/sign-up">Get started</Link>
    </>
  );
}
