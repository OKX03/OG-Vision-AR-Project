"use client";

import { useEffect } from "react";
import { userService } from "@/services/user.service";

export default function AuthInitializer() {

  useEffect(() => {
    userService.setAutoLogout();
  }, []);

  return null;
}