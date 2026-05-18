'use client';

import React, { useState, useEffect, useRef } from 'react';
import { chatbotService } from '@/services/chatbot.service';
import { userService } from '@/services/user.service';
import './chat-bot.css';
import Link from 'next/link';

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
      endChatSession();
      sessionStorage.removeItem('og_chat_session');
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
                <Link key={p.product_id} href={`/customer/product-details/${p.product_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="chat-product-card d-flex align-items-center">
                    <div className="flex-grow-1">
                      <h6 className="fw-bold mb-1 text-dark">{p.brand} - {p.model}</h6>
                      <div className="text-success fw-bold">RM {p.price}</div>
                    </div>
                    <i className="bi bi-chevron-right text-secondary fs-5"></i>
                  </div>
                </Link>
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
        <Link href="/customer/customer-service" className="btn btn-outline-secondary me-3 rounded-circle" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="bi bi-arrow-left"></i>
        </Link>
        <h2 className="fw-bold mb-0">AI Assistant</h2>
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