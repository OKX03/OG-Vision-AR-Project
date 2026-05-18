'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { faqService } from '@/services/faq.service';
import { Modal, Button } from 'react-bootstrap';

export default function EditFAQPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [faq, setFaq] = useState({
    category: '',
    question: '',
    answer: '',
  });

  const [errors, setErrors] = useState<any>({});
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);

  useEffect(() => {
    if (id) {
      fetchFAQDetails();
    }
    fetchCategories();
  }, [id]);

  const fetchCategories = async () => {
    try {
      const res = await faqService.getAllFAQs();
      const categories = Array.from(new Set(res.data.map((f: any) => f.category))) as string[];
      const filtered = categories.filter(Boolean);
      setExistingCategories(filtered);
      if (filtered.length === 0) {
        setShowNewCategory(true);
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'NEW_CATEGORY_OPTION') {
      setShowNewCategory(true);
      handleChange('category', '');
    } else {
      handleChange('category', e.target.value);
    }
  };

  const fetchFAQDetails = async () => {
    try {
      const res = await faqService.getFAQById(id);
      setFaq({
        category: res.data.category,
        question: res.data.question,
        answer: res.data.answer,
      });
    } catch (err) {
      console.error(err);
      alert('Failed to fetch FAQ details');
      router.back();
    }
  };

  const handleChange = (field: string, value: string) => {
    setFaq({ ...faq, [field]: value });
    setErrors((prev: any) => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const errors: any = {};

    if (!faq.category) errors.category = 'Category is required';
    if (!faq.question.trim()) errors.question = 'Question is required';
    if (!faq.answer.trim()) errors.answer = 'Answer is required';

    setErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const onSubmit = async () => {
    const valid = validateForm();
    if (!valid) {
      setShowIncomplete(true);
      return;
    }

    try {
      await faqService.updateFAQ(id, faq);
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Failed to update FAQ');
    }
  };

  return (
    <div className="container mt-5 mb-5">
      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <button className="btn btn-dark" onClick={() => router.back()}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <h2 className="h4 mb-0 fw-bold">Edit FAQ</h2>
          </div>
        </div>

        <div className="card-body p-4">
          <div className="mb-4" style={{ maxWidth: '300px' }}>
            <label className="form-label fw-medium text-secondary d-flex justify-content-between align-items-center">
              Category
              {showNewCategory && existingCategories.length > 0 && (
                <span 
                  className="text-primary text-decoration-underline" 
                  style={{ cursor: 'pointer', fontSize: '0.85rem' }}
                  onClick={() => {
                    setShowNewCategory(false);
                    handleChange('category', '');
                  }}
                >
                  Select Existing
                </span>
              )}
            </label>
            {!showNewCategory && existingCategories.length > 0 ? (
              <select
                className={`form-select ${errors.category ? 'is-invalid' : ''}`}
                value={existingCategories.includes(faq.category) ? faq.category : ''}
                onChange={handleCategorySelect}
              >
                <option value="" disabled>Select category...</option>
                {existingCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="NEW_CATEGORY_OPTION" className="text-primary fw-bold">+ Add New Category</option>
              </select>
            ) : (
              <input
                type="text"
                className={`form-control ${errors.category ? 'is-invalid' : ''}`}
                placeholder="Enter new category name"
                value={faq.category}
                onChange={e => handleChange('category', e.target.value)}
              />
            )}
          </div>

          <div className="mb-4">
            <label className="form-label fw-medium text-secondary">Question</label>
            <textarea
              rows={3}
              className={`form-control ${errors.question ? 'is-invalid' : ''}`}
              placeholder="question"
              value={faq.question}
              onChange={e => handleChange('question', e.target.value)}
            />
          </div>

          <div className="mb-5">
            <label className="form-label fw-medium text-secondary">Answer</label>
            <textarea
              rows={3}
              className={`form-control ${errors.answer ? 'is-invalid' : ''}`}
              placeholder="answer"
              value={faq.answer}
              onChange={e => handleChange('answer', e.target.value)}
            />
          </div>

          <div className="d-flex justify-content-end">
            <button className="btn btn-success fw-medium px-4" onClick={onSubmit}>
              Save
            </button>
          </div>
        </div>
      </div>

      <Modal show={showIncomplete} centered onHide={() => setShowIncomplete(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-warning mb-3">
            <i className="bi bi-exclamation-circle" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Required information is incomplete!</h5>
          <p className="text-muted">Please update the missing fields.</p>
          <Button variant="danger" onClick={() => setShowIncomplete(false)}>
            Okay
          </Button>
        </Modal.Body>
      </Modal>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>FAQ Successfully Updated!</h5>
          <Button
            className="btn btn-success mt-3 px-5"
            onClick={() => {
              setShowSuccess(false);
              router.push('/admin/faq-list');
            }}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}
