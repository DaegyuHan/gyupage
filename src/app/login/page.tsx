import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "로그인 | 규페이지" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
