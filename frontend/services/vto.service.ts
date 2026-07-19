import axiosInstance from "@/services/axios-instance";

const BASE_URL = '/vto';

export const VtoService = {
  // Uploads a 3D model (.glb, .gltf, .fbx) for Virtual Try-On mapping.
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

  // Deletes a Virtual Try-On 3D model associated with a specific product.
  deleteModel: async (productId: string) => {
    const res = await axiosInstance.delete(`${BASE_URL}/${productId}`);
    return res.data;
  },

  // Fetches the Virtual Try-On 3D model details for a specific product.
  getModelByProductId: async (productId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${productId}`);
    return res.data;
  },

  // Saves calibration data (position, scale, rotation) for a product's Virtual Try-On model.
  saveCalibration: async (productId: string, calibrationData: any) => {
    const res = await axiosInstance.put(`${BASE_URL}/${productId}/calibration`, calibrationData);
    return res.data;
  },

};