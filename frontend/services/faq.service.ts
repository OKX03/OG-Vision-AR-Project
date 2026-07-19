import axiosInstance from './axios-instance';

const BASE_URL = '/faqs';

export const faqService = {
  // Fetches all FAQs from the backend API.
  getAllFAQs: () => axiosInstance.get(BASE_URL),

  // Fetches a single FAQ by its ID.
  getFAQById: (id: string | number) => axiosInstance.get(`${BASE_URL}/${id}`),

  // Creates a new FAQ entry in the database.
  createFAQ: (data: any) => axiosInstance.post(BASE_URL, data),

  // Updates an existing FAQ by its ID.
  updateFAQ: (id: string | number, data: any) => axiosInstance.put(`${BASE_URL}/${id}`, data),

  // Deletes a FAQ from the database by its ID.
  deleteFAQ: (id: string | number) => axiosInstance.delete(`${BASE_URL}/${id}`),
};
