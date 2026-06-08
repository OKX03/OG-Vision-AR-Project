"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { userService } from "@/services/user.service";
import { Modal, Button } from "react-bootstrap";

export default function RegisterPage() {
  const router = useRouter();

  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRegisterForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!registerForm.username.trim()) newErrors.username = "Username is required";
    else if (registerForm.username.length < 3) newErrors.username = "Username must be at least 3 characters";
    else if (registerForm.username.length > 20) newErrors.username = "Username must be at most 20 characters";

    if (!registerForm.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(registerForm.email)) newErrors.email = "Email must be a valid email address";

    if (!registerForm.password) newErrors.password = "Password is required";
    else if (registerForm.password.length < 6) newErrors.password = "Password must be at least 6 characters";

    if (!registerForm.confirmPassword) newErrors.confirmPassword = "Confirm Password is required";
    else if (registerForm.password !== registerForm.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    if (!registerForm.gender) newErrors.gender = "Gender is required";

    return newErrors;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      const data = await userService.register(
        registerForm.username,
        registerForm.email,
        registerForm.password,
        registerForm.gender
      );

      setShowSuccess(true);
    } catch (err: any) {
      console.log("Registration error:", err);
      const msg = err.response?.data?.message || "Registration failed!";
      const newErrors: { username?: string; email?: string } = {};
      if (msg.toLowerCase().includes("username")) newErrors.username = msg;
      if (msg.toLowerCase().includes("email")) newErrors.email = msg;

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
      }
    }
  };

  return (
    <div className="left-panel">
      <div className="left-content">
        <div className="logo">OG Vision AR</div>
        <div className="welcome">Welcome 👋</div>

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              placeholder="Enter your username"
              value={registerForm.username}
              onChange={handleChange}
              className={`form-control ${submitted && errors.username ? "is-invalid" : ""}`}
            />
            {errors.username && (
              <div className="invalid-feedback">{errors.username}</div>
            )}
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={registerForm.email}
              onChange={handleChange}
              className={`form-control ${submitted && errors.email ? "is-invalid" : ""}`}
            />
            {errors.email && (
              <div className="invalid-feedback">{errors.email}</div>
            )}
          </div>

          <div className="form-group">
            <label>Password</label>

            <div className="input-wrapper position-relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={registerForm.password}
                onChange={handleChange}
                className={`form-control ${submitted && errors.password ? "is-invalid" : ""}`}
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

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrapper position-relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={registerForm.confirmPassword}
                onChange={handleChange}
                className={`form-control ${submitted && errors.confirmPassword ? "is-invalid" : ""}`}
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

          <div className="form-group">
            <label>Gender</label>
            <select
              name="gender"
              value={registerForm.gender}
              onChange={handleChange}
              className={`form-control ${submitted && errors.gender ? "is-invalid" : ""}`}
            >
              <option value="" disabled>Select your gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            {errors.gender && (
              <div className="invalid-feedback">{errors.gender}</div>
            )}
          </div>

          <button type="submit" className="btn btn-dark w-100">
            Create Account
          </button>
        </form>

        <div className="auth-link mt-3">
          Already have an account? <a href="/auth/login">Login</a>
        </div>
      </div>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5> Registration Successful!</h5>
          <p className="small text-muted">
            Please check your email to verify your account before logging in.
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