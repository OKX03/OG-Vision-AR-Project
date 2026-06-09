  "use client";
  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { userService } from "@/services/user.service";
  import { Modal, Button } from "react-bootstrap";

  export default function RecoverPasswordPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [errors, setErrors] = useState<any>({});
    const [submitted, setSubmitted] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = async (e: any) => {
      e.preventDefault();
      setSubmitted(true);


      const newErrors: { email?: string } = {};
      if (!email.trim()) newErrors.email = "Email is required";
      else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email must be a valid email address";

      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) return;

      try {
        console.log("Sending email for password recovery:", email);
        await userService.recoverPassword(email);
        setShowSuccess(true);
      } catch (err: any) {
        console.log("Error sending reset link:", err);
        const msg = err.response?.data?.message || "Failed to send reset link!";
        if (msg.toLowerCase().includes("email")) {
          console.log("Setting email error:", msg);
          setErrors({ email: msg });
        } 
      }
    };

    return (
      <div className="left-panel">
        <div className="left-content">
          <div className="logo">OG Vision AR</div>
          <div className="welcome">Recover Password 🔐</div>

          <form className="form" onSubmit={handleSubmit} noValidate>
            <p className="text-muted small text-center">
              Enter your registered email and we'll send you a reset link.
            </p>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                 placeholder="Enter your registered email"
                className={`form-control ${submitted && errors.email ? "is-invalid" : ""}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              {errors.email && (
                <div className="invalid-feedback d-block">{errors.email}</div>
              )}
            </div>

            <button className="btn btn-dark w-100">Send Reset Link</button>
          </form>

          <div className="auth-link mt-3">
            <a href="/auth/login">Back to Login</a>
          </div>
        </div>

        <Modal show={showSuccess} centered backdrop="static">
          <Modal.Body className="text-center p-4">
            <div className="text-success mb-3">
              <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
            </div>
            <h5> Reset Link Sent!</h5>
            <p className="small text-muted">
              Please check your email to continue resetting your password.
            </p>

            <Button
              className="btn btn-success mt-3 px-5"
              onClick={() => {
                setShowSuccess(false);
                router.push("/auth/login");
              }}
            >
              Go to Login
            </Button>
          </Modal.Body>
        </Modal>        
      </div>
    );
  }