'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { userService } from '@/services/user.service';
import { sharedOnnxFaceShapeService } from '@/services/onnx.service';
import RoleGuard from '@/guard/role-guard';
import './layout.css';

type Props = {
  children: ReactNode;
};

export default function UserLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
    
    // Preload ONNX model to ensure efficiency when opening the virtual try-on page
    fetch('/face_shape_model/model.onnx', { cache: 'force-cache' }).catch(() => {});
    
    // Globally initialize the ONNX face shape model in the background
    // This dramatically boosts VTO loading times without crashing memory, 
    // because it uses dynamic import for the heavy WASM binaries!
    sharedOnnxFaceShapeService.init();
  }, []);

  const logout = async () => {
    await userService.logout();
  };

  const checkActive = (paths: string | string[]) => {
    if (Array.isArray(paths)) {
      return paths.some(path => pathname.includes(path)) ? "active" : "";
    }

    return pathname.includes(paths) ? "active" : "";
  };

  return (
    <div className="user-layout">
      <div className="bg-dark" style={{ height: '6px' }}></div>

      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div className="container-fluid">

          <span
            className="navbar-brand fw-bold me-3 cursor-pointer"
            onClick={() => router.push('/customer/home')}
          >
            OG Vision AR
          </span>

          <div className="ms-auto d-flex align-items-center gap-3 order-lg-3 me-2">
            <i
              className="bi bi-person fs-4 cursor-pointer"
              onClick={() => {
                router.push('/customer/profile');
                setMenuOpen(false);
              }}
            ></i>

            <button
              className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
              onClick={logout}
            >
              <i className="bi bi-box-arrow-right"></i>
              Logout
            </button>
          </div>

          <button
            className="navbar-toggler order-lg-2 me-1"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div
            className={`collapse navbar-collapse order-lg-1 ${
              menuOpen ? 'show' : ''
            }`}
          >
            <ul className="navbar-nav me-auto">

              <li className="nav-item">
                <span
                  className={`nav-link cursor-pointer ${checkActive('/customer/home')}`}
                  onClick={() => {
                    router.push('/customer/home');
                    setMenuOpen(false);
                  }}
                >
                  Home
                </span>
              </li>

              <li className="nav-item">
                <span
                  className={`nav-link cursor-pointer ${checkActive([
                    '/customer/product-list', 
                    '/customer/product-details'
                  ])}`}
                  onClick={() => {
                    router.push('/customer/product-list');
                    setMenuOpen(false);
                  }}
                >
                  Product
                </span>
              </li>

              <li className="nav-item">
                <span
                  className={`nav-link cursor-pointer ${checkActive('/customer/virtual-try-on')}`}
                  onClick={() => {
                    router.push('/customer/virtual-try-on');
                    setMenuOpen(false);
                  }}
                >
                  Virtual Try-On
                </span>
              </li>

              <li className="nav-item">
                <span
                  className={`nav-link cursor-pointer ${checkActive('/customer/booking-list')}`}
                  onClick={() => {
                    router.push('/customer/booking-list');
                    setMenuOpen(false);
                  }}
                >
                  My Bookings
                </span>
              </li>

              <li className="nav-item">
                <span
                  className={`nav-link cursor-pointer ${checkActive([
                    '/customer/customer-service', 
                    '/customer/chat-bot'
                  ])}`}
                  onClick={() => {
                    router.push('/customer/customer-service');
                    setMenuOpen(false);
                  }}
                >
                  Customer Service
                </span>
              </li>

            </ul>
          </div>

        </div>
      </nav>

      <div className="content container-fluid mt-4">
        <RoleGuard allowedRoles={["ROLE_CUSTOMER", "ROLE_USER"]}>
          {children}
        </RoleGuard>
      </div>

      <footer className="bg-dark text-light py-4 mt-5">
        <div className="container">
          <p className="text-center mb-0">
            &copy; {new Date().getFullYear()} OG Vision AR. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}