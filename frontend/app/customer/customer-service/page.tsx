'use client';

import React, { useState, useEffect } from 'react';
import { faqService } from '@/services/faq.service';
import Link from 'next/link';
import './customer-service.css';

interface FAQ {
  faq_id: number;
  category: string;
  question: string;
  answer: string;
}

export default function CustomerServicePage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      const res = await faqService.getAllFAQs();
      setFaqs(res.data);
      
      if (res.data.length > 0) {
        setSelectedCategory(res.data[0].category);
      }
    } catch (err) {
      console.error('Failed to fetch FAQs:', err);
    }
  };

  // Scalable color palette
  const colorPalette = [
    { bg: '#E3F2FD', text: '#1976D2' }, 
    { bg: '#E8F5E9', text: '#2E7D32' }, 
    { bg: '#FFF3E0', text: '#F57C00' }, 
    { bg: '#F3E5F5', text: '#7B1FA2' }, 
    { bg: '#E0F7FA', text: '#0097A6' }, 
    { bg: '#FCE4EC', text: '#C2185B' }, 
  ];

  // Dynamic icons and cyclic colors
  const getDynamicCategories = () => {
    const uniqueCategoryNames = Array.from(new Set(faqs.map(faq => faq.category)));
    
    return uniqueCategoryNames.map((name, index) => {
      const lowerName = name.toLowerCase();
      let icon = 'bi-collection'; 
      
      if (lowerName.includes('product') || lowerName.includes('frame') || lowerName.includes('lens')) icon = 'bi-eyeglasses';
      else if (lowerName.includes('virtual') || lowerName.includes('try-on') || lowerName.includes('ar')) icon = 'bi-person-bounding-box';
      else if (lowerName.includes('purchase') || lowerName.includes('book') || lowerName.includes('buy')) icon = 'bi-bag-check';
      else if (lowerName.includes('privacy') || lowerName.includes('data') || lowerName.includes('security')) icon = 'bi-shield-check';
      else if (lowerName.includes('recommend')) icon = 'bi-stars';
      else if (lowerName.includes('ship') || lowerName.includes('delivery')) icon = 'bi-box-seam';
      else if (lowerName.includes('account') || lowerName.includes('profile')) icon = 'bi-person-circle';

      const theme = colorPalette[index % colorPalette.length];
      return { name, icon, theme };
    });
  };

  const categories = getDynamicCategories();
  const displayedCategories = showAllCategories ? categories : categories.slice(0, 8);
  const hasMoreCategories = categories.length > 8;
  const filteredFaqs = faqs.filter(f => f.category === selectedCategory);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setOpenFaqId(null); 
  };

  const toggleFaq = (id: number) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  return (
    <div className="container py-4 mb-5" style={{ maxWidth: '1000px' }}>
      <h2 className="fw-bold mb-4">Frequently Asked Questions</h2>

      <div className="faq-category-container mb-5">
        <h4 className="fw-semibold mb-4">Category</h4>
        
        <div className="row g-3">
          {displayedCategories.map((cat) => {
            const isActive = selectedCategory === cat.name;
            return (
              <div className="col-6 col-md-3" key={cat.name}>
                <div 
                  className={`faq-category-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleCategorySelect(cat.name)}
                  style={{
                    borderColor: isActive ? cat.theme.text : '#ced4da',
                    boxShadow: isActive ? `0 0 0 1px ${cat.theme.text}` : 'none'
                  }}
                >
                  <div 
                    className="faq-icon-box"
                    style={{
                      backgroundColor: isActive ? cat.theme.text : cat.theme.bg,
                      color: isActive ? '#ffffff' : cat.theme.text
                    }}
                  >
                    <i className={`bi ${cat.icon}`}></i>
                  </div>
                  <span 
                    className="fw-semibold category-text"
                    style={{ color: isActive ? cat.theme.text : '#333' }}
                  >
                    {cat.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {hasMoreCategories && (
          <div className="text-center mt-4 pt-3 border-top">
            <button 
              className="btn btn-outline-dark btn-sm rounded-pill px-4"
              onClick={() => setShowAllCategories(!showAllCategories)}
            >
              {showAllCategories ? (
                <>Show Less <i className="bi bi-chevron-up ms-1"></i></>
              ) : (
                <>Show More Categories <i className="bi bi-chevron-down ms-1"></i></>
              )}
            </button>
          </div>
        )}
      </div>

      {selectedCategory && (
        <div className="mb-5 faq-list-container">
          <h4 className="fw-bold mb-4">{selectedCategory}</h4>
          
          {filteredFaqs.length > 0 ? (
            <div className="custom-faq-list">
              {filteredFaqs.map((faq) => {
                const isOpen = openFaqId === faq.faq_id;
                
                return (
                  <div 
                    key={faq.faq_id} 
                    className={`custom-faq-item ${isOpen ? 'open' : ''}`}
                  >
                    <div 
                      className="custom-faq-question" 
                      onClick={() => toggleFaq(faq.faq_id)}
                    >
                      <h6 className="mb-0 fw-bold">{faq.question}</h6>
                      <i className={`bi ${isOpen ? 'bi-dash-circle-fill' : 'bi-plus-circle'} toggle-icon`}></i>
                    </div>
                    
                    <div className="custom-faq-answer">
                      <p className="mb-0 text-muted">{faq.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted p-4 text-center border rounded bg-light">
              No FAQs found for this category.
            </p>
          )}
        </div>
      )}

      {/* Support Section */}
      <div className="text-center mt-5">
        <h5 className="fw-bold mb-4">Still Need Help?</h5>
      </div>

      <div className="row mt-4 pt-3 border-top position-relative help-section">
        {/* Contact Us (Left side on Desktop, Full Width on Mobile) */}
        <div className="col-md-5 pe-md-4">
          <h6 className="fw-bold text-decoration-underline mb-4">Contact Us</h6>
          
          <div className="row mb-3">
            <div className="col-6">
              <p className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>Contact No:</p>
              <a href="tel:+601118655866" className="text-dark text-decoration-underline" style={{ fontSize: '0.9rem' }}>+6011-18655866</a>
            </div>
            <div className="col-6">
              <p className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>Operating Hours:</p>
              <p className="mb-1" style={{ fontSize: '0.9rem' }}>Monday - Saturday</p>
              <p className="mb-1 text-muted" style={{ fontSize: '0.85rem' }}>&bull; 10:00 AM - 7:00 PM</p>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-6">
              <p className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>WhatsApps:</p>
              <a href="https://wa.me/601118655866" target="_blank" rel="noopener noreferrer" className="text-success fs-4">
                <i className="bi bi-whatsapp"></i>
              </a>
            </div>
            <div className="col-6">
              <p className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>Sunday</p>
              <p className="mb-1 text-muted" style={{ fontSize: '0.85rem' }}>&bull; Closed</p>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <p className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>Email Address:</p>
              <a href="mailto:ogopticalwatchsb@gmail.com" className="text-dark text-decoration-underline" style={{ fontSize: '0.9rem' }}>ogopticalwatchsb@gmail.com</a>
            </div>
          </div>
        </div>

        {/* Divider (Hidden on Mobile) */}
        <div className="d-none d-md-block position-absolute" style={{ width: '1px', height: '100%', backgroundColor: '#dee2e6', left: '50%', top: '2rem' }}></div>

        {/* AI Chatbot Card (Hidden on Mobile, Shifted Right on Desktop via offset-md-2) */}
        <div className="d-none d-md-block col-md-5 offset-md-2 mt-md-0 ps-md-4">
          <h6 className="fw-bold text-decoration-underline mb-4">AI Chatbot</h6>
          
          <Link href="/customer/chat-bot" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="chatbot-card mt-2" style={{ cursor: 'pointer' }}>
              <div className="chatbot-icon-box">
                <i className="bi bi-robot"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-1">AI Chatbot</h6>
                <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
                  Just tell us what you're looking for — your style, face shape, or preferred brand — and we'll recommend frames that suit you best.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Sticky Mobile Chatbot Icon (Hidden on Desktop) */}
      <Link href="/customer/chat-bot">
        <div className="d-md-none sticky-chatbot-fab" title="Open AI Chatbot">
          <i className="bi bi-robot"></i>
        </div>
      </Link>
    </div>
  );
}