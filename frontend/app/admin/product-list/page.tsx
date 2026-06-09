'use client';

import React, { useEffect, useState } from "react";
import { productService } from "@/services/product.service";
import { Product } from "@/types/product";
import namer from "color-namer";
import { Modal, Button, Offcanvas } from "react-bootstrap";
import { useRouter } from "next/navigation";
import "@/app/customer/product-list/product-list.css";

export default function ProductListPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedFaceShapes, setSelectedFaceShapes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(2000);

  const [brands, setBrands] = useState<string[]>([]);
  const sizes = ["S", "M", "L", "XL"];
  const genders = ["Men", "Women", "Unisex"];
  const shapes = ["Square", "Rectangle", "Round", "Browline", "Wayfarer"];
  const materials = ["Metal", "Plastic", "Acetate"];
  const faceShapes = ["Oval", "Round", "Square", "Heart", 'Oblong'];


  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
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
      setBrands([...new Set(data.map((p: Product) => p.brand).filter(Boolean))] as string[]);
      console.log("Processed products:", data);
    } catch (err) {
      console.error(err);
      if ((err as any).response?.status === 403) {
        router.replace("/auth/login");
      }
    }
  };

  const applyFilter = () => {
    let list = products.filter((p) => {
      return (
        (searchText === "" ||
          p.brand?.toLowerCase().includes(searchText.toLowerCase()) ||
          p.model?.toLowerCase().includes(searchText.toLowerCase())) &&
        (selectedBrands.length === 0 || selectedBrands.includes(p.brand!)) &&
        (selectedSizes.length === 0 || selectedSizes.includes(p.frameSize!)) &&
        (selectedGenders.length === 0 || selectedGenders.includes(p.gender!)) &&
        (selectedShapes.length === 0 || selectedShapes.includes(p.frameShape!)) &&
        (selectedMaterials.length === 0 || selectedMaterials.includes(p.frameMaterial!)) &&
        (selectedFaceShapes.length === 0 || p.faceShape?.some((s) => selectedFaceShapes.includes(s))) &&
        (p.price! >= minPrice) &&
        (p.price! <= maxPrice)
      );
    });
    setFilteredProducts(list);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (products.length > 0) {
      applyFilter();
    }
  }, [
    searchText,
    selectedBrands,
    selectedSizes,
    selectedGenders,
    selectedShapes,
    selectedMaterials,
    selectedFaceShapes,
    minPrice,
    maxPrice,
    products
  ]);

  const toggle = (value: string, list: string[], setList: (v: string[]) => void, checked: boolean) => {
    let updated = [...list];
    if (checked) updated.push(value);
    else updated = updated.filter((v) => v !== value);
    setList(updated);
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedSizes([]);
    setSelectedGenders([]);
    setSelectedShapes([]);
    setSelectedMaterials([]);
    setSelectedFaceShapes([]);
    setSearchText("");
    setMinPrice(0);
    setMaxPrice(2000);
  };

  const activeFilterTags = [
    ...selectedBrands,
    ...selectedSizes,
    ...selectedGenders,
    ...selectedShapes,
    ...selectedMaterials,
    ...selectedFaceShapes,
  ];

  const removeFilterTag = (tag: string) => {
    setSelectedBrands((b) => b.filter((v) => v !== tag));
    setSelectedSizes((b) => b.filter((v) => v !== tag));
    setSelectedGenders((b) => b.filter((v) => v !== tag));
    setSelectedShapes((b) => b.filter((v) => v !== tag));
    setSelectedMaterials((b) => b.filter((v) => v !== tag));
    setSelectedFaceShapes((b) => b.filter((v) => v !== tag));
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

              <div className="d-flex align-items-center ms-2 me-3 flex-grow-1" style={{ maxWidth: "500px" }}>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by brand or model..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
                
                <button
                  className="btn btn-outline-secondary ms-2 text-nowrap"
                  type="button"
                  onClick={() => setShowFilter(true)}
                >
                  <i className="bi bi-funnel"></i> Filter
                  {activeFilterTags.length > 0 && (
                    <span className="badge bg-secondary ms-1">{activeFilterTags.length}</span>
                  )}
                </button>
              </div>

              <Button className="me-2 text-nowrap" variant="primary" size="sm" onClick={() => router.push("/admin/add-product")}>
                <i className="bi bi-plus-lg me-1"></i> Add Product
              </Button>
            </div>
          </div>

          {activeFilterTags.length > 0 && (
            <div className="row mt-3 ms-1">
              <div className="col">
                {activeFilterTags.map((tag) => (
                  <span key={tag} className="badge bg-light text-dark border me-2 mb-2" style={{ cursor: "pointer" }} onClick={() => removeFilterTag(tag)}>
                    {tag} <i className="bi bi-x ms-1"></i>
                  </span>
                ))}
                <span className="badge bg-white text-danger border border-danger ms-1 mb-2" style={{ cursor: "pointer" }} onClick={clearFilters}>
                  Clear All
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Offcanvas Filter */}
        <Offcanvas show={showFilter} onHide={() => setShowFilter(false)} placement="end">
          <Offcanvas.Header closeButton className="border-bottom">
            <Offcanvas.Title className="fw-bold">Filters</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Filters
              brands={brands}
              sizes={sizes}
              genders={genders}
              shapes={shapes}
              materials={materials}
              faceShapes={faceShapes}
              selectedBrands={selectedBrands}
              selectedSizes={selectedSizes}
              selectedGenders={selectedGenders}
              selectedShapes={selectedShapes}
              selectedMaterials={selectedMaterials}
              selectedFaceShapes={selectedFaceShapes}
              toggle={toggle}
              minPrice={minPrice}
              maxPrice={maxPrice}
              setMinPrice={setMinPrice}
              setMaxPrice={setMaxPrice}
              applyFilter={applyFilter}
              setSelectedBrands={setSelectedBrands}
              setSelectedSizes={setSelectedSizes}
              setSelectedGenders={setSelectedGenders}
              setSelectedShapes={setSelectedShapes}
              setSelectedMaterials={setSelectedMaterials}
              setSelectedFaceShapes={setSelectedFaceShapes}
            />
            <button className="btn btn-outline-secondary w-100 mt-3 mb-4" onClick={clearFilters}>Clear All Filters</button>
          </Offcanvas.Body>
        </Offcanvas>

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
                <th>Qty</th>
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
                  <td colSpan={13} className="text-center text-muted py-4">
                    No Product Exist
                  </td>
                </tr>
              ) : (paginatedProducts.map((p, i) => {
                const qty = p.quantity || 0;

                return (
                <tr key={p.product_id}>
                  <td className="fw-semibold text-center">{(currentPage - 1) * pageSize + i + 1}</td>
                  <td>
                    {p.frontImage && <img src={p.frontImage} className="rounded shadow-sm" width={70} height={50} style={{ objectFit: "cover" }} />}
                  </td>
                  <td className="fw-semibold">{p.brand}</td>
                  <td>{p.model}</td>
                  <td className="text-success fw-semibold">RM {p.price}</td>
                  <td className="text-center">
                    {qty === 0 ? (
                      <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1">
                        Sold Out (0)
                      </span>
                    ) : qty <= 3 ? (
                      <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-50 px-2 py-1">
                        Low ({qty})
                      </span>
                    ) : (
                      <span className="fw-bold px-2 py-1">{qty}</span>
                    )}
                  </td>
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
                          onClick={() => router.push(`/admin/manage-ar/${p.product_id}`)}
                        >
                          <i className="bi bi-file-earmark-code me-2"></i>
                          <span className="fw-semibold small">Model Ready</span>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline-secondary" size="sm" onClick={() => router.push(`/admin/manage-ar/${p.product_id}`)}>
                        Upload AR
                      </Button>
                    )}
                  </td>
                </tr>
                );
              }))}
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
          <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" className="px-4" onClick={confirmDelete}>Confirm</Button>
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

const Filters = ({
  brands, sizes, genders, shapes, materials, faceShapes,
  selectedBrands, selectedSizes, selectedGenders, selectedShapes, selectedMaterials, selectedFaceShapes,
  toggle, minPrice, maxPrice, setMinPrice, setMaxPrice, applyFilter,
  setSelectedBrands, setSelectedSizes, setSelectedGenders, setSelectedShapes, setSelectedMaterials, setSelectedFaceShapes
}: any) => {
  return (
    <>
      <div className="mb-4">
        <h6 className="fw-semibold">Gender</h6>
        {genders.map((g: string) => (
          <div key={g} className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={selectedGenders.includes(g)}
              onChange={(e) => toggle(g, selectedGenders, setSelectedGenders, e.target.checked)}
            />
            <label className="form-check-label">{g}</label>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h6 className="fw-semibold">Brand</h6>
        {brands.map((b: string) => (
          <div key={b} className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={selectedBrands.includes(b)}
              onChange={(e) => toggle(b, selectedBrands, setSelectedBrands, e.target.checked)}
            />
            <label className="form-check-label">{b}</label>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h6 className="fw-semibold">Price (RM {minPrice} - RM {maxPrice})</h6>
        <input
          type="range"
          className="form-range"
          min={0}
          max={2000}
          step={50}
          value={maxPrice}
          onChange={(e) => { setMaxPrice(Number(e.target.value)); applyFilter(); }}
        />
        <div className="d-flex gap-2 mt-2">
          <input
            type="number"
            className="form-control form-control-sm"
            value={minPrice}
            onChange={(e) => { setMinPrice(Number(e.target.value)); applyFilter(); }}
          />
          <input
            type="number"
            className="form-control form-control-sm"
            value={maxPrice}
            onChange={(e) => { setMaxPrice(Number(e.target.value)); applyFilter(); }}
          />
        </div>
      </div>

      <div className="mb-4">
        <div className="d-flex align-items-center mb-2">
          <h6 className="fw-semibold mb-0">Frame Size</h6>

          <div className="custom-tooltip-container ms-2">
            <i
              className="bi bi-question-circle text-muted"
              style={{ cursor: "help", fontSize: "0.9rem" }}
            ></i>

            <div className="custom-tooltip-content shadow-sm">
              <div className="fw-bold mb-1 border-bottom pb-1">Lens Width:</div>
              <div className="d-flex justify-content-between"><span>S (Small):</span> <span>&lt; 49mm</span></div>
              <div className="d-flex justify-content-between"><span>M (Medium):</span> <span>49 - 54mm</span></div>
              <div className="d-flex justify-content-between"><span>L (Large):</span> <span>55 - 58mm</span></div>
              <div className="d-flex justify-content-between"><span>XL (Extra Large):</span> <span>&gt; 58mm</span></div>
            </div>
          </div>
        </div>

        {sizes.map((s: string) => (
          <div key={s} className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={selectedSizes.includes(s)}
              onChange={(e) => toggle(s, selectedSizes, setSelectedSizes, e.target.checked)}
            />
            <label className="form-check-label">{s}</label>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h6 className="fw-semibold">Frame Shape</h6>
        {shapes.map((s: string) => (
          <div key={s} className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={selectedShapes.includes(s)}
              onChange={(e) => toggle(s, selectedShapes, setSelectedShapes, e.target.checked)}
            />
            <label className="form-check-label">{s}</label>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h6 className="fw-semibold">Material</h6>
        {materials.map((m: string) => (
          <div key={m} className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={selectedMaterials.includes(m)}
              onChange={(e) => toggle(m, selectedMaterials, setSelectedMaterials, e.target.checked)}
            />
            <label className="form-check-label">{m}</label>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h6 className="fw-semibold">Face Shape</h6>
        {faceShapes.map((f: string) => (
          <div key={f} className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={selectedFaceShapes.includes(f)}
              onChange={(e) => toggle(f, selectedFaceShapes, setSelectedFaceShapes, e.target.checked)}
            />
            <label className="form-check-label">{f}</label>
          </div>
        ))}
      </div>
    </>
  );
};