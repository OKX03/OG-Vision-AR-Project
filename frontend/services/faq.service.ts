import axiosInstance from './axios-instance';

const BASE_URL = '/faqs';

export const faqService = {
  getAllFAQs: () => axiosInstance.get(BASE_URL),

  getFAQById: (id: string | number) => axiosInstance.get(`${BASE_URL}/${id}`),

  createFAQ: (data: any) => axiosInstance.post(BASE_URL, data),

  updateFAQ: (id: string | number, data: any) => axiosInstance.put(`${BASE_URL}/${id}`, data),

  deleteFAQ: (id: string | number) => axiosInstance.delete(`${BASE_URL}/${id}`),
};
