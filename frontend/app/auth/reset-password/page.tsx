"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { userService } from "@/services/user.service";
import { Modal, Button } from "react-bootstrap";

import { Suspense } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateForm = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";

    if (!confirmPassword) newErrors.confirmPassword = "Confirm Password is required";
    else if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setShowConfirm(true);
    }
  };

  const handleConfirmReset = async () => {
    try {
      await userService.resetPassword(email, token, password);
      setShowConfirm(false);
      setShowSuccess(true);
    } catch (err: any) {
      setErrors({ password: err.message });
      setShowConfirm(false);
    }
  };

  return (
    <div className="left-panel">
      <div className="left-content">
        <div className="logo">OG Vision AR</div>
        <div className="welcome">Reset Password 🔑</div>

        <form className="form" onSubmit={handleSubmit}>

          <div className="form-group position-relative">
            <label>New Password</label>
            
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className={`form-control ${submitted && errors.password ? "is-invalid" : ""}`}
                placeholder="Enter new password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />

              <span
                className="toggle-password"
                onClick={() => setShowPassword(prev => !prev)}
              >
                <i className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
              </span>
            </div>

            {errors.password && (
              <div className="invalid-feedback d-block">{errors.password}</div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group position-relative">
            <label>Confirm Password</label>
            <div className="input-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              className={`form-control ${submitted && errors.confirmPassword ? "is-invalid" : ""}`}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
              <span
                className="toggle-password"
                onClick={() => setShowConfirmPassword(prev => !prev)}
              >
                <i className={showConfirmPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
              </span>
            </div>
            {errors.confirmPassword && (
              <div className="invalid-feedback d-block">{errors.confirmPassword}</div>
            )}
          </div>

          <button className="btn btn-dark w-100 mt-3">Reset Password</button>
        </form>

        <div className="auth-link mt-3">
          <a href="/auth/login">Back to Login</a>
        </div>
      </div>      
      
      <Modal show={showConfirm} centered onHide={() => setShowConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Reset</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-4">
            Are you sure you want to reset your password?
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="success" onClick={handleConfirmReset}>Confirm</Button>
          <Button variant="danger" onClick={() => setShowConfirm(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Password Reset Successful!</h5>
          <p className="small text-muted">
            You can now login with your new password.
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}