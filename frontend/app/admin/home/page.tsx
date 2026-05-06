"use client";

import { useEffect, useState } from "react";
import { productService } from "@/services/product.service";
import "./admin-home.css";

export default function AdminHome() {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    retrieveProducts();
  }, []);

  const retrieveProducts = async () => {
    try {
      const response = await productService.getAllProducts();
      setProducts(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-container">

      <header className="dashboard-header">
        <h2>Admin Dashboard</h2>
        <p>Select a module below to begin managing your application data.</p>
      </header>

      <section className="management-section">

        <div className="section-label">Manage your platform in a single system</div>

        <div className="cards-grid">

          <a href="/admin/product-list" className="dashboard-card product">
            <div className="card-icon">
              <i className="bi bi-eyeglasses icon-bg"></i>
            </div>
            <div className="card-text">
              <h3>Product Management</h3>
              <p>Manage your inventory of {products.length} eyewear.</p>
            </div>
          </a>

          <a href="/admin/try-on" className="dashboard-card vto">
            <div className="card-icon">
              <i className="bi bi-vr icon-bg"></i>
            </div>
            <div className="card-text">
              <h3>Virtual Try-On</h3>
              <p>Test the 3D asset of eyewear.</p>
            </div>
          </a>

          <a href="/admin/faq" className="dashboard-card faq">
            <div className="card-icon">
              <i className="bi bi-chat-dots icon-bg"></i>
            </div>
            <div className="card-text">
              <h3>FAQ Management</h3>
              <p>Update customer support questions, categories, and helpful answers.</p>
            </div>
          </a>

        </div>

      </section>

    </div>
  );
}