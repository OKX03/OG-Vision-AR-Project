'use client';

import React, { useState, useEffect, useRef } from 'react';
import { chatbotService } from '@/services/chatbot.service';
import { userService } from '@/services/user.service';
import './chat-bot.css';
import { useRouter } from 'next/navigation';

interface Message {
  message_id?: number;
  sender: 'user' | 'model' | 'function';
  content: string;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const sessionIdRef = useRef<number | null>(null);
  const router = useRouter(); 

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const endChatSession = () => {
      const currentId = sessionIdRef.current;
      if (currentId) {
        const token = userService.getToken();
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        if (token) {
          fetch(`${baseUrl}/api/chatbot/session/${currentId}/end`, {
            method: 'PUT',
            headers: { 'x-access-token': token },
            keepalive: true
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', endChatSession);
    
    return () => {
      window.removeEventListener('beforeunload', endChatSession);
    };
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const existingSession = sessionStorage.getItem('og_chat_session');
    
    if (existingSession) {
      const parsedSessionId = parseInt(existingSession);
      setSessionId(parsedSessionId);
      loadExistingHistory(parsedSessionId);
    } else {
      initSession();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const loadExistingHistory = async (id: number) => {
    try {
      setIsLoading(true);
      const res = await chatbotService.getSessionHistory(id);
      setMessages(res.data);
    } catch (error) {
      initSession();
    } finally {
      setIsLoading(false);
    }
  };

  const initSession = async () => {
    try {
      setIsLoading(true);
      const res = await chatbotService.createSession();
      setSessionId(res.data.session_id);
      setMessages(res.data.messages);
      sessionStorage.setItem('og_chat_session', res.data.session_id.toString());
    } catch (error) {
      setMessages([{ sender: 'model', content: 'Sorry, could not connect to the AI Assistant at this time.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await chatbotService.sendMessage(sessionId, userMessage);
      setMessages(prev => [...prev, res.data]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'model', content: 'Sorry, I encountered an error connecting to the server.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatContent = (content: string) => {
    const parts = content.split('__PRODUCTS__');
    
    if (parts.length >= 3) {
      const textPart = parts[0];
      const productsJson = parts[1];
      try {
        const products = JSON.parse(productsJson);
        let formattedText = textPart.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\n/g, '<br />');
        
        return (
          <>
            <span dangerouslySetInnerHTML={{ __html: formattedText }} />
            <div className="product-recommendation-cards mt-3 d-flex flex-column gap-2">
              {products.map((p: any) => (
                <div 
                  key={p.product_id} 
                  onClick={() => router.push(`/customer/product-details/${p.product_id}`)} 
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <div className="chat-product-card d-flex align-items-center gap-3">
                    {p.image_url && (
                      <div className="flex-shrink-0 bg-light rounded d-flex justify-content-center align-items-center" style={{ width: '70px', height: '70px' }}>
                        <img 
                          src={p.image_url.startsWith('http') ? p.image_url : `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${p.image_url}`} 
                          alt={p.model}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    <div className="flex-grow-1">
                      <h6 className="fw-bold mb-1 text-dark">{p.brand} - {p.model}</h6>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>Color:</span>
                        <div className="d-flex align-items-center gap-1">
                          <span
                            style={{ 
                              backgroundColor: p.color_hex, 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%',
                              display: 'inline-block',
                              border: '1px solid #dee2e6'
                            }}
                          ></span>
                          <span style={{ fontSize: '0.85rem' }}>{p.color_name}</span>
                        </div>
                      </div>
                      <div className="text-success fw-bold">RM {p.price}</div>
                    </div>
                    <i className="bi bi-chevron-right text-secondary fs-5"></i>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      } catch (e) {
      }
    }

    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="container py-4 mb-5 chatbot-page-container">
      <div className="d-flex align-items-center mb-4">
          <button className="btn btn-dark" onClick={() => router.back()}>
            <i className="bi bi-arrow-left"></i>
          </button>
        <h2 className="fw-bold ms-2 mb-0">AI Assistant</h2>
      </div>

      <div className="chatbot-window shadow-sm">
        <div className="chatbot-messages-container">
          {messages.map((msg, idx) => (
            msg.sender !== 'function' && (
              <div key={idx} className={`page-chat-message ${msg.sender}`}>
                <div className="message-content">
                  {formatContent(msg.content)}
                </div>
              </div>
            )
          ))}
          {isLoading && (
            <div className="page-chat-message model">
              <div className="message-content">
                <div className="spinner-grow spinner-grow-sm text-secondary me-1" role="status"></div>
                <div className="spinner-grow spinner-grow-sm text-secondary me-1" role="status"></div>
                <div className="spinner-grow spinner-grow-sm text-secondary" role="status"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-input-section border-top">
          <form className="d-flex p-3 gap-2 align-items-center bg-white" onSubmit={handleSend} style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            <input 
              type="text" 
              className="form-control rounded-pill px-4 py-2"
              placeholder="Type your message here..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-dark rounded-circle" disabled={!input.trim() || isLoading} style={{ width: '45px', height: '45px' }}>
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}