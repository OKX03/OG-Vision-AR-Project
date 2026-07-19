import axiosInstance from './axios-instance';

export const chatbotService = {
  // Initializes a new chat session with the AI assistant.
  createSession: () => {
    return axiosInstance.post('/chatbot/session');
  },
  
  // Retrieves the chat history for a given session ID.
  getSessionHistory: (sessionId: number) => {
    return axiosInstance.get(`/chatbot/session/${sessionId}`);
  },

  // Sends a user message to the AI chatbot within a specific session.
  sendMessage: (sessionId: number, message: string) => {
    return axiosInstance.post('/chatbot/message', { session_id: sessionId, message });
  },

  // Ends an active chat session.
  endSession: (sessionId: number) => {
    return axiosInstance.put(`/chatbot/session/${sessionId}/end`);
  }
};
