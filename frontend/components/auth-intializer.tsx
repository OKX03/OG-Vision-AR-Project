"use client";

import { useEffect } from "react";
import { authService } from "@/services/auth.service";

export default function AuthInitializer() {

  useEffect(() => {
    authService.setAutoLogout();
  }, []);

  return null;
}