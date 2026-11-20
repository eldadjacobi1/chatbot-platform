import AuthShell from "../../AuthShell";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn forceRedirectUrl="/dashboard" />
    </AuthShell>
  );
}
