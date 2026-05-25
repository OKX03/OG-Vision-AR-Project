"use client";

import { useEffect, useState } from "react";
import { productService } from "@/services/product.service";
import { Product } from "@/types/product";
import namer from "color-namer";
import { useRouter } from 'next/navigation';
import "./product-list.css";

export default function ProductListPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

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

  const [sortOption, setSortOption] = useState("default");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const skeletonArray = Array.from({ length: 8 });

  // Fetch products from API
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await productService.getAllProducts();
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
        frontImage: frontImage ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${frontImage.image_url}` : "",
        colorName,
        frameSize: frameSize,
        faceShape: item.face_shape ? item.face_shape.split("_") : [],
        arModel: item.ar_model ? item.ar_model.file_path : null,
      };
    });

    setProducts(data);
    console.log("Fetched products:", data);
    setFilteredProducts(data);
    setBrands([...new Set(data.map((p: Product) => p.brand).filter(Boolean))] as string[]);
    setLoading(false);
    applyFilter(data);
  };

  const applyFilter = (baseList = products) => {
    let list = baseList.filter((p) => {
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
        p.price! >= minPrice &&
        p.price! <= maxPrice
      );
    });

    console.log("After filtering:", list);

    if (sortOption === "priceLow") list.sort((a, b) => a.price! - b.price!);
    else if (sortOption === "priceHigh") list.sort((a, b) => b.price! - a.price!);
    else if (sortOption === "brand") list.sort((a, b) => a.brand!.localeCompare(b.brand!));

    setFilteredProducts(list);
    updatePagination(list);
  };

  useEffect(() => {
    applyFilter();
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
    sortOption,
    currentPage,
  ]);

  const toggle = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    checked: boolean
  ) => {
    let updated = [...list];
    if (checked) updated.push(value);
    else updated = updated.filter((v) => v !== value);
    setList(updated);
    setCurrentPage(1);
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
    setCurrentPage(1);
  };

  const updatePagination = (list: Product[]) => {
    setTotalProducts(list.length);
    const pages = Math.ceil(list.length / itemsPerPage) || 1;
    setTotalPages(pages);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    setPaginatedProducts(list.slice(start, end));
  };

  const totalPagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);
  const startProduct = totalProducts === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endProduct = currentPage * itemsPerPage > totalProducts ? totalProducts : currentPage * itemsPerPage;

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
    setCurrentPage(1);
  };

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  return (
    <div className="container-fluid product-page">
      <div className="row">

        <div className="d-lg-none p-3 border-bottom d-flex justify-content-between">
          <button
            className="btn btn-outline-dark"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#filterSidebar"
          >
            <i className="bi bi-funnel me-2"></i> Filters
            {activeFilterTags.length > 0 && (
              <span className="badge bg-dark ms-1">{activeFilterTags.length}</span>
            )}
          </button>
        </div>

        <div className="offcanvas offcanvas-start" tabIndex={-1} id="filterSidebar">
          <div className="offcanvas-header">
            <h5 className="offcanvas-title">Filters</h5>
            <button className="btn-close" data-bs-dismiss="offcanvas"></button>
          </div>
          <div className="offcanvas-body">
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
            <button className="btn btn-outline-secondary w-100 mt-3" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>

        <div className="col-lg-3 d-none d-lg-block border-end">
          <div className="filter-sidebar p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0">Filters</h5>
              {activeFilterTags.length > 0 && <span className="badge bg-dark">{activeFilterTags.length}</span>}
            </div>
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
            <button className="btn btn-outline-secondary w-100 mt-3" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>

        <div className="col-lg-9 p-4">
          <h3 className="fw-bold mb-3">Products</h3>

          <div className="row g-3 align-items-center mb-3">

            <div className="col-12 col-md-6 col-lg-4">
              <input
                className="form-control"
                placeholder="Search glasses..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-6 col-lg-3 ms-lg-auto">
              <select
                className="form-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="default">Sort by</option>
                <option value="priceLow">Price: Low → High</option>
                <option value="priceHigh">Price: High → Low</option>
                <option value="brand">Brand A → Z</option>
              </select>
            </div>

          </div>

          <div className="mb-3">
            {activeFilterTags.map((tag) => (
              <span key={tag} className="badge bg-light text-dark border me-2 mb-2" style={{ cursor: "pointer" }} onClick={() => removeFilterTag(tag)}>
                {tag} <i className="bi bi-x ms-1"></i>
              </span>
            ))}
          </div>

          <div className="row g-4">
            {loading &&
              skeletonArray.map((_, i) => (
                <div key={i} className="col-xl-3 col-lg-4 col-md-6">
                  <div className="card h-100">
                    <div className="skeleton-img"></div>
                    <div className="card-body">
                      <div className="skeleton-line"></div>
                      <div className="skeleton-line small"></div>
                    </div>
                  </div>
                </div>
              ))}

            {!loading && paginatedProducts.length === 0 && (
              <div className="col-12">
                <div className="text-center py-5">
                  <h5 className="mt-3">No Product Exist</h5>

                  {(searchText || activeFilterTags.length > 0) && (
                    <button className="btn btn-outline-dark mt-2" onClick={clearFilters}>
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            )}

            {!loading &&
              paginatedProducts.length > 0 &&
              paginatedProducts.map((p) => (
                <div key={p.product_id} className="col-xl-3 col-lg-4 col-md-6">
                  <div className="card h-100 shadow-sm border-0">
                    <div
                      className="d-flex align-items-center justify-content-center bg-light"
                      style={{ height: "140px" }}
                    >
                      {p.frontImage ? (
                        <img
                          src={p.frontImage}
                          alt="product"
                          className="img-fluid"
                          style={{ maxHeight: "120px", objectFit: "contain" }}
                        />
                      ) : (
                        <span className="text-muted small">No Image</span>
                      )}
                    </div>

                    <div className="card-body p-2 text-center">
                      <h6 className="fw-semibold mb-1 small">{p.brand}</h6>

                      <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                        <p className="text-muted small mb-0 text-truncate">{p.model}</p>

                        {p.color && (
                          <span
                            className="badge border d-inline-flex align-items-center gap-1"
                            style={{ fontSize: "9px", padding: "3px 6px" }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                backgroundColor: p.color,
                                display: "inline-block",
                              }}
                            ></span>
                            <span className="text-dark">{p.colorName}</span>
                          </span>
                        )}
                      </div>

                      <p className="fw-bold text-primary mb-2 small">RM {p.price}</p>

                      <button
                        className="btn btn-dark btn-sm w-100"
                        onClick={() =>
                          router.push(`/customer/product-details/${p.product_id}`)
                        }
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="d-flex justify-content-between align-items-center mt-4">
            <div className="text-muted small">
              Showing {startProduct} to {endProduct} of {totalProducts} products
            </div>
            <nav>
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={prevPage}>Previous</button>
                </li>
                {totalPagesArray.map((p) => (
                  <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(p)}>{p}</button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                  <button className="page-link" onClick={nextPage}>Next</button>
                </li>
              </ul>
            </nav>
          </div>
        </div>

      </div>
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