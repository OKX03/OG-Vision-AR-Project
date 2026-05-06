"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function VTOPage() {
  const router = useRouter();
  const params = useSearchParams();
  const productId = params.get("product_id");

  useEffect(() => {
    if (productId) {
      router.replace(`/customer/virtual-try-on/entry?product_id=${encodeURIComponent(productId)}`);
    } else {
      router.replace(`/customer/virtual-try-on/entry`);
    }
  }, []);

  return null;
}