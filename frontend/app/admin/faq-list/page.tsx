'use client';

import React, { useEffect, useState } from "react";
import { faqService } from "@/services/faq.service";
import { Modal, Button } from "react-bootstrap";
import { useRouter } from "next/navigation";

interface FAQ {
  faq_id: number;
  category: string;
  question: string;
  answer: string;
  created_at?: string;
  updated_at?: string;
}

export default function FAQListPage() {
  const router = useRouter();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [filteredFaqs, setFilteredFaqs] = useState<FAQ[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      const res = await faqService.getAllFAQs();
      setFaqs(res.data);
      setFilteredFaqs(res.data);
    } catch (err) {
      console.error(err);
      if ((err as any).response?.status === 403) {
        router.replace("/auth/login");
      }
    }
  };

  const applyFilter = (category: string) => {
    setSelectedCategory(category);
    if (!category) {
      setFilteredFaqs(faqs);
    } else {
      const filtered = faqs.filter((f) => f.category === category);
      setFilteredFaqs(filtered);
    }
    setCurrentPage(1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setShowConfirmDelete(false);
    try {
      await faqService.deleteFAQ(deleteTarget.faq_id);
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Failed to delete FAQ!");
    }
  };

  const totalPages = Math.ceil(filteredFaqs.length / pageSize);
  const paginatedFaqs = filteredFaqs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const uniqueCategories = Array.from(new Set(faqs.map(f => f.category))).filter(Boolean);

  return (
    <div className="container py-4">
      <div className="card shadow-sm border-0">
        {/* Header */}
        <div className="mb-3">
          <div className="row ms-2 mb-2 mt-2">
            <div className="col">
              <h2 className="mb-0">FAQs</h2>
            </div>
          </div>

          <div className="row mt-3">
            <div className="col d-flex justify-content-between align-items-center">
              <div className="ms-3" style={{ width: "200px" }}>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => applyFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <Button className="me-3" variant="primary" size="sm" onClick={() => router.push("/admin/add-faq")}>
                <i className="bi bi-plus-lg me-1"></i> Add FAQ
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3" style={{ width: "5%" }}>No.</th>
                <th style={{ width: "15%" }}>Category</th>
                <th style={{ width: "30%" }}>Question</th>
                <th style={{ width: "40%" }}>Answer</th>
                <th className="text-center" style={{ width: "10%" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFaqs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No FAQs Exist
                  </td>
                </tr>
              ) : (paginatedFaqs.map((faq, i) => (
                <tr key={faq.faq_id}>
                  <td className="fw-semibold px-3">{(currentPage - 1) * pageSize + i + 1}.</td>
                  <td>{faq.category}</td>
                  <td>{faq.question}</td>
                  <td>{faq.answer}</td>
                  <td className="text-center" style={{ minWidth: "90px" }}>
                    <Button variant="outline-primary" size="sm" className="me-1" onClick={() => router.push(`/admin/edit-faq/${faq.faq_id}`)}>
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => { setDeleteTarget(faq); setShowConfirmDelete(true); }}>
                      <i className="bi bi-trash"></i>
                    </Button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3 px-3 pb-4">
            <div className="text-muted small">
              Showing {paginatedFaqs.length} of {filteredFaqs.length} FAQs
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
                <li className={`page-item ${totalPages === 0 || currentPage === totalPages ? "disabled" : ""}`}>
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
          Are you sure you want to <b className="text-danger">Delete </b>this FAQ?
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
          <h5>FAQ Deleted Successfully!</h5>
          <Button
            className="btn btn-success mt-3 px-5"
            onClick={() => {
              setShowSuccess(false);
              fetchFAQs();
            }}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}
