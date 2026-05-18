import axiosInstance from './axios-instance';

export const chatbotService = {
  createSession: () => {
    return axiosInstance.post('/chatbot/session');
  },
  
  getSessionHistory: (sessionId: number) => {
    return axiosInstance.get(`/chatbot/session/${sessionId}`);
  },

  sendMessage: (sessionId: number, message: string) => {
    return axiosInstance.post('/chatbot/message', { session_id: sessionId, message });
  },

  endSession: (sessionId: number) => {
    return axiosInstance.put(`/chatbot/session/${sessionId}/end`);
  }
};
