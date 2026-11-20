import Link from "next/link";
import AuthShell from "../../AuthShell";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp forceRedirectUrl="/dashboard" />
      <p className="auth-terms">By signing up you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.</p>
    </AuthShell>
  );
}
