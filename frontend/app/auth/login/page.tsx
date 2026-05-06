"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storageService } from "@/services/storage.service";
import { userService } from "@/services/user.service";

export default function LoginPage() {
  const router = useRouter();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // If user is already logged in, redirect to appropriate home page
    if (userService.hasValidToken()) {
      if (userService.hasRole("ROLE_ADMIN")) {
        router.replace("/admin/home");
      } else if (userService.hasRole("ROLE_CUSTOMER") || userService.hasRole("ROLE_USER")) {
        router.replace("/customer/home");
      } else {
        router.replace("/");
      }
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors: { username?: string; password?: string } = {};

    if (!loginForm.username.trim()) newErrors.username = "Username or email is required!";
    if (!loginForm.password) newErrors.password = "Password is required!";
    else if (loginForm.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    return newErrors;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      const data = await userService.login(loginForm.username, loginForm.password);

      storageService.saveUser(data);
      userService.setAutoLogout();

      if (userService.hasRole("ROLE_ADMIN")) {
        window.location.href = "/admin/home";
      } else if (userService.hasRole("ROLE_CUSTOMER") || userService.hasRole("ROLE_USER")) {
        window.location.href = "/customer/home";
      } else {
        window.location.href = "/";
      }
    } catch (err: any) {
        console.log("Login error:", err);
        const msg = err.response?.data?.message || "Login failed";

        const newErrors: { username?: string; password?: string } = {};

        if (msg.toLowerCase().includes("password")) {
          newErrors.password = msg;
        } else if (msg.toLowerCase().includes("user")) {
          newErrors.username = msg;
        } else {
          newErrors.username = msg;
        }

        setErrors(newErrors);
    }
  };

  return (
      <div className="left-panel">
        <div className="left-content">
          <div className="logo">OG Vision AR</div>
          <div className="welcome">Welcome back 👋</div>

          <form className="form" onSubmit={onSubmit} noValidate>
            <div className="form-group">
              <label>Username or Email</label>
              <input
                type="text"
                name="username"
                className={`form-control ${submitted && errors.username ? "is-invalid" : ""}`}
                placeholder="Enter your username or email"
                value={loginForm.username}
                onChange={handleChange}
                suppressHydrationWarning
              />
                {errors.username && (
                  <div className="invalid-feedback">{errors.username}</div>
                )}
            </div>

            <div className="form-group">
              <label>Password</label>

              <div className="input-wrapper position-relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className={`form-control ${submitted && errors.password ? "is-invalid" : ""}`}
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={handleChange}
                  suppressHydrationWarning
                />

                <span
                  className="toggle-password"
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  <i className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
                </span>
              </div>

              {errors.password && (
                <div className="invalid-feedback d-block">
                  {errors.password}
                </div>
              )}
            </div>

          <div className="text-end mt-1">
            <a href="/auth/recover-password" className="small">Forgot Password?</a>
          </div>

            <div className="form-group mt-3">
              <button 
                className="btn btn-dark w-100" 
                type="submit"
                suppressHydrationWarning>
                Login
              </button>
            </div>
          </form>

          <div className="auth-link mt-3">
            Don't have an account? <a href="/auth/register">Register</a>
          </div>
        </div>
      </div>
  );
}