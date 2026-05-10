"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { userService } from "@/services/user.service";
import RoleGuard from "@/guard/role-guard";
import "./layout.css";

interface Props {
  children: React.ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title = "OG Vision AR" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const toggleMenu = () => setIsOpen(!isOpen);

  const logout = async () => {
    await userService.logout();
  };

  const navigateTo = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const checkActive = (path: string) => {
    return pathname.includes(path) ? "active" : "";
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
        <div 
          className={`sidenav-item ${checkActive('/admin/home')}`} 
          onClick={() => navigateTo('/admin/home')}
        >
          Home
        </div>
        <div 
          className={`sidenav-item ${checkActive('/admin/product-list')}`} 
          onClick={() => navigateTo('/admin/product-list')}
        >
          Product
        </div>
        <div 
          className={`sidenav-item ${checkActive('/admin/virtual-try-on')}`} 
          onClick={() => navigateTo('/admin/virtual-try-on')}
        >
          Virtual Try-On
        </div>
        <div 
          className={`sidenav-item ${checkActive('/admin/booking-list')}`} 
          onClick={() => navigateTo('/admin/booking-list')}
        >
          Booking
        </div> 
      </nav>

      {/* Main Content */}
      <div className="admin-main-content">
        {children}
      </div>
    </RoleGuard>
  );
}