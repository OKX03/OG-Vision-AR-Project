"use client";

import React, { ReactNode } from "react";
import "./auth.css";

type Props = {
  children: ReactNode;
};

export default function AuthLayout({ children }:Props) {
  return (
    <div className="auth-container">
      <div className="left-panel">{children}</div>

      <div className="right-panel d-none d-md-block"></div>
    </div>
  );
}