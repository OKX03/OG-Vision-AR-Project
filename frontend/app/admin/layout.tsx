"use client";

import { useState } from "react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import RoleGuard from "@/guard/role-guard";
import "./layout.css";

interface Props {
  children: React.ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title = "OG Vision AR" }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const logout = async () => {
    await authService.logout();
  };

  return (
    <RoleGuard allowedRoles={["ROLE_ADMIN"]}>
      <header className="header">
        <div className="top-bar"></div>

        <div className="header-content navbar">
          <div className="left-group">
            <button className="menu-btn" onClick={toggleMenu}>
              <span className="navbar-toggler-icon"></span>
            </button>
            <h1 className="title">{title}</h1>
          </div>

          <button
            className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
            onClick={logout}
          >
            <i className="bi bi-box-arrow-right"></i>
            Logout
          </button>
        </div>
      </header>

      {/* Side Menu */}
      <nav className={`sidenav ${isOpen ? "open" : ""}`}>
        <Link href="/admin/home">Home</Link>
        <Link href="/admin/product-list">Product</Link>
        <Link href="/admin/virtual-try-on">Virtual Try-On</Link>
        <Link href="/admin/booking-list">Booking</Link> 
      </nav>

      {/* Main Content */}
      <div className="admin-main-content">
        {children}
      </div>
    </RoleGuard>
  );
}