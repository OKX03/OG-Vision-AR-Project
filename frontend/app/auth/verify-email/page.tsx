"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { userService } from "@/services/user.service";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!email || !token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    userService.verifyEmail(email, token)
      .then(() => {
        setStatus("success");
        setMessage("Email verified successfully! You can now log in.");
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "Verification failed. The link may be invalid or expired.");
      });
  }, [email, token]);

  return (
    <div className="left-panel">
      <div className="left-content text-center d-flex flex-column justify-content-center align-items-center h-100">
        <div className="logo mb-4">OG Vision AR</div>
        <div className="welcome mb-3">Email Verification</div>

        {status === "loading" && (
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        )}

        {status === "success" && (
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
        )}

        {status === "error" && (
          <div className="text-danger mb-3">
            <i className="bi bi-x-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
        )}

        <p className="mt-3">{message}</p>

        {status !== "loading" && (
          <button 
            className="btn btn-dark w-100 mt-4" 
            onClick={() => router.push("/auth/login")}
          >
            Go to Login
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
