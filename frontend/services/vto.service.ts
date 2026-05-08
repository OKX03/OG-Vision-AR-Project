import axiosInstance from "@/services/axios-instance";

const BASE_URL = '/vto';

export const VtoService = {
  uploadModel: async (productId: string, file: File) => {
    console.log("Uploading model to backend!!");
    const formData = new FormData();
    formData.append("vto_model", file);
    console.log("Form Data", formData.get("vto_model"));

    const directUrl = process.env.BACKEND_API_URL || "http://localhost:8080";

    const res = await axiosInstance.post(
      `${directUrl}/api${BASE_URL}/${productId}`,
      formData,
      {
        baseURL: '',
      }
    );
    console.log("File uploaded successfully!");
    return res.data;
  },

  deleteModel: async (productId: string) => {
    const res = await axiosInstance.delete(`${BASE_URL}/${productId}`);
    return res.data;
  },

  getModelByProductId: async (productId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${productId}`);
    return res.data;
  },

  saveCalibration: async (productId: string, calibrationData: any) => {
    const res = await axiosInstance.put(`${BASE_URL}/${productId}/calibration`, calibrationData);
    return res.data;
  },

};