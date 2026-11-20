import AuthShell from "../../AuthShell";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp forceRedirectUrl="/dashboard" />
    </AuthShell>
  );
}
