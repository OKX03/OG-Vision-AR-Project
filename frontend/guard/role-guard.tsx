'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { userService } from '@/services/user.service';

interface ProtectedPageProps {
  allowedRoles?: string[];
  children: React.ReactNode;
}

const RoleGuard: React.FC<ProtectedPageProps> = ({ allowedRoles, children }) => {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = userService.getToken();
    const role = userService.getRole();

    if (!token || !userService.hasValidToken()) {
      router.replace('/auth/login');
      return;
    }

    console.log('User role from storage:', role);
    console.log('Allowed roles:', allowedRoles);

    if (allowedRoles && !allowedRoles.includes(role!)) {
      router.replace('/auth/login');
      return;
    }

    setIsAllowed(true);
  }, [allowedRoles, router]);

  if (isAllowed === null) return <div>Loading...</div>;

  return <>{children}</>;
};

export default RoleGuard;