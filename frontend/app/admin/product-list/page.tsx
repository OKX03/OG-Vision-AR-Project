'use client';

import React, { useEffect, useState } from "react";
import { productService } from "@/services/product.service";
import { Product } from "@/types/product";
import namer from "color-namer";
import { Modal, Button } from "react-bootstrap";
import { useRouter } from "next/navigation"; import "./product-list.css";


export default function ProductListPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);



  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await productService.getAllProducts();
      console.log("Fetched products:", res.data);

      const data: Product[] = res.data.map((item: any) => {
        const frontImage = item.images?.find((img: any) => img.view_type === "front");
        const colorName = item.color ? namer(item.color).ntc[0].name : "";

        let frameSize = item.frame_size;
        frameSize = (() => {
          switch (frameSize) {
            case "Small": return "S";
            case "Medium": return "M";
            case "Large": return "L";
            case "Extra Large": return "XL";
            default: return frameSize;
          }
        })();
        return {
          ...item,
          frameMaterial: item.frame_material,
          frameShape: item.frame_shape,
          frontImage: frontImage ? "http://localhost:8080" + frontImage.image_url : "",
          colorName,
          frameSize: frameSize,
          faceShape: item.face_shape ? item.face_shape.split("_") : [],
          arModel: item.ar_model ? item.ar_model.file_path : null,
        };
      });
      setProducts(data);
      setFilteredProducts(data);
      console.log("Processed products:", data);
    } catch (err) {
      console.error(err);
      if ((err as any).response?.status === 403) {
        router.replace("/auth/login");
      }
    }
  };

  const applyFilter = (keyword: string) => {
    setSearchText(keyword);
    const filtered = products.filter(
      (p) =>
        p.brand?.toLowerCase().includes(keyword.toLowerCase()) ||
        p.model?.toLowerCase().includes(keyword.toLowerCase())
    );
    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setShowConfirmDelete(false);
    try {
      await productService.deleteProduct(deleteTarget.product_id!);
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Failed to delete product!");
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="container py-4">
      <div className="card shadow-sm border-0">
        {/* Header */}
        <div className="mb-3">
          <div className="row ms-2 mb-2">
            <div className="col">
              <h2 className="mb-0">Products</h2>
            </div>
          </div>

          <div className="row">
            <div className="col d-flex justify-content-between align-items-center">

              <div className="input-group ms-2 me-3" style={{ maxWidth: "300px" }}>
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by brand or model..."
                  value={searchText}
                  onChange={(e) => applyFilter(e.target.value)}
                />
              </div>

              <Button className="me-2" variant="primary" size="sm" onClick={() => router.push("/admin/add-product")}>
                <i className="bi bi-plus-lg me-1"></i> Add Product
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>No</th>
                <th>Image</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Price</th>
                <th>Color</th>
                <th>Frame Shape</th>
                <th>Frame Size</th>
                <th>Material</th>
                <th>Face Shape</th>
                <th className="text-center">Action</th>
                <th>AR</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center text-muted py-4">
                    No Product Exist
                  </td>
                </tr>
              ) : (paginatedProducts.map((p, i) => (
                <tr key={p.product_id}>
                  <td className="fw-semibold text-center">{(currentPage - 1) * pageSize + i + 1}</td>
                  <td>
                    {p.frontImage && <img src={p.frontImage} className="rounded shadow-sm" width={70} height={50} style={{ objectFit: "cover" }} />}
                  </td>
                  <td className="fw-semibold">{p.brand}</td>
                  <td>{p.model}</td>
                  <td className="text-success fw-semibold">RM {p.price}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      <span className="rounded me-2 border" style={{ width: 16, height: 16, background: p.color }}></span>
                      {p.colorName}
                    </div>
                  </td>
                  <td>{p.frameShape}</td>
                  <td>{p.frameSize}</td>
                  <td>{p.frameMaterial}</td>
                  <td>
                    {p.faceShape?.map((shape, idx) => (
                      <span key={idx} className="badge bg-light text-dark me-1">{shape}</span>
                    ))}
                  </td>
                  <td className="text-center" style={{ minWidth: "90px" }}>
                    <Button variant="outline-primary" size="sm" className="me-1" onClick={() => router.push(`/admin/edit-product/${p.product_id}`)}>
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => { setDeleteTarget(p); setShowConfirmDelete(true); }}>
                      <i className="bi bi-trash"></i>
                    </Button>
                  </td>
                  <td>
                    {p.arModel ? (
                      <div className="d-flex flex-column align-items-start">
                        <div
                          className="d-flex align-items-center text-success cursor-pointer"
                          style={{ cursor: "pointer" }}
                          onClick={() => router.push(`/admin/upload-ar/${p.product_id}`)}
                        >
                          <i className="bi bi-file-earmark-code me-2"></i>
                          <span className="fw-semibold small">Model Ready</span>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline-secondary" size="sm" onClick={() => router.push(`/admin/upload-ar/${p.product_id}`)}>
                        Upload AR
                      </Button>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3 px-3 pb-4">
            <div className="text-muted small">
              Showing {paginatedProducts.length} of {filteredProducts.length} products
            </div>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>Previous</button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <li key={page} className={`page-item ${page === currentPage ? "active" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(page)}>{page}</button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}>Next</button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>

      <Modal show={showConfirmDelete} centered onHide={() => setShowConfirmDelete(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          Are you sure you want to <b className="text-danger">Delete </b>the selected product?
          <p className="text-muted">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="danger" className="px-4" onClick={confirmDelete}>Delete</Button>
          <Button variant="light" onClick={() => setShowConfirmDelete(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Product Deleted Successfully!</h5>
          <Button
            className="btn btn-success mt-3 px-5"
            onClick={() => {
              setShowSuccess(false);
              fetchProducts();
            }}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}