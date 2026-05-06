import axiosInstance from './axios-instance';

const BASE_URL = '/products';

export const productService = {
  getAllProducts: () => axiosInstance.get(BASE_URL),

  getProductById: (id: string) => axiosInstance.get(`${BASE_URL}/${id}`),

  createProduct: (data: any) => axiosInstance.post(BASE_URL, data),

  updateProduct: (id: string, data: any) => axiosInstance.put(`${BASE_URL}/${id}`, data),

  deleteProduct: (id: string) => axiosInstance.delete(`${BASE_URL}/${id}`),
};