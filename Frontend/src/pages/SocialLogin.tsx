// src/pages/SocialLogin.tsx
import { useNavigate } from "react-router-dom";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup } from "firebase/auth";
import PageLayout from "../components/PageLayout";

export function SocialLogin() {
  const navigate = useNavigate();
  const auth = getAuth();

  const handleOAuth = async (provider: GoogleAuthProvider | OAuthProvider) => {
    try {
      const result = await signInWithPopup(auth, provider);
      // don’t write to your DB here—just move into onboarding
      navigate("/onboarding", { state: { uid: result.user.uid } });
    } catch (err: any) {
      console.error("Social sign-in error:", err);
      alert("Sign-in failed. Please try again.");
    }
  };

  return (
    <PageLayout>
      <div>
        <button onClick={() => handleOAuth(new GoogleAuthProvider())}>
          Sign up with Google
        </button>
        <button onClick={() => {
          const apple = new OAuthProvider("apple.com");
          handleOAuth(apple);
        }}>
          Sign up with Apple
        </button>
      </div>
    </PageLayout>
  );
}
