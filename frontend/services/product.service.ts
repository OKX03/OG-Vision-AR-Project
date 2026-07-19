import axiosInstance from './axios-instance';

const BASE_URL = '/products';

export const productService = {
  // Fetches all products from the backend API.
  getAllProducts: () => axiosInstance.get(BASE_URL),

  // Fetches a specific product by its ID.
  getProductById: (id: string) => axiosInstance.get(`${BASE_URL}/${id}`),

  // Creates a new product.
  createProduct: (data: any) => axiosInstance.post(BASE_URL, data),

  // Updates an existing product.
  updateProduct: (id: string, data: any) => axiosInstance.put(`${BASE_URL}/${id}`, data),

  // Deletes a product from the database.
  deleteProduct: (id: string) => axiosInstance.delete(`${BASE_URL}/${id}`),
};