"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/services/axios-instance";
import { useRouter } from "next/navigation";
import namer from "color-namer";

type Product = {
  product_id: string;
  brand: string;
  model: string;
  color?: string;
  colorName?: string;
  frontImage: string;
};

export default function UserHomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const router = useRouter();

  useEffect(() => {
    retrieveProducts();
  }, []);

  const retrieveProducts = async () => {
    try {
      const res = await axiosInstance.get("/products");

      const data: Product[] = res.data.slice(0, 6).map((item: any) => {
        const frontImage = item.images?.find(
          (img: any) => img.view_type === "front"
        );

        const colorName = item.color ? namer(item.color).ntc[0].name : "";

        return {
          product_id: item.product_id,
          brand: item.brand,
          model: item.model,
          color: item.color,
          colorName: colorName,
          frontImage: frontImage
            ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${frontImage.image_url}`
            : "",
        };
      });

      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  return (
    <div className="container py-4">
      <style>{`
        .home-product-card {
          transition: all 0.2s ease;
          cursor: pointer;
          border: 1px solid #eee;
        }
        .home-product-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1) !important;
          border-color: #999;
        }
      `}</style>
      {/* 🔹 Top Section */}
      <section className="row align-items-center mb-5">
        <div className="col-lg-6 col-md-12 mb-4 mb-lg-0">
          <h1 className="display-4 fw-bold">
            Explore Eyewear with AR Try-On
          </h1>

          <p className="lead text-muted">
            Find your perfect pair from the comfort of your home with our AR virtual try-on technology.
          </p>

          <button
            className="btn btn-primary px-4 py-2"
            onClick={() => router.push("/customer/product-list")}
          >
            Explore Products
          </button>
        </div>

        <div className="col-lg-6 col-md-12 text-center">
          <img
            src="/images/user_home.png"
            alt="Eyewear AR Try-On"
            className="img-fluid rounded"
          />
        </div>
      </section>

      <section>
        <h2 className="text-center fw-bold mb-4">
          Featured Products
        </h2>

        <div className="row g-4 justify-content-center">
          {products.slice(0, 5).map((product) => (
            <div
              key={product.product_id}
              className="col-12 col-sm-6 col-md-4 col-lg-3 col-xl-2"
            >
              <div 
                className="card h-100 text-center shadow-sm home-product-card"
                onClick={() => router.push(`/customer/product-details/${product.product_id}`)}
              >

                {product.frontImage && (
                  <img
                    src={product.frontImage}
                    alt={`${product.brand} ${product.model}`}
                    className="card-img-top p-3"
                    style={{
                      height: "160px",
                      objectFit: "contain",
                    }}
                  />
                )}

                <div className="card-body p-2">
                  <h6 className="fw-bold mb-1">
                    {product.brand}
                  </h6>
                  <p className="text-muted small mb-1">
                    {product.model}
                  </p>
                  {product.color && (
                    <div className="d-flex justify-content-center">
                      <span
                        className="badge border d-inline-flex align-items-center gap-1"
                        style={{ fontSize: "9px", padding: "3px 6px" }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: product.color,
                            display: "inline-block",
                          }}
                        ></span>
                        <span className="text-dark">{product.colorName}</span>
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}