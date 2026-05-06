import axiosInstance from "@/services/axios-instance";

export const VtoService = {
  upload: async (productId: string, file: File) => {
    const formData = new FormData();
    formData.append("vto_model", file);

    const res = await axiosInstance.post(`/vto/${productId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  delete: async (productId: string) => {
    const res = await axiosInstance.delete(`/vto/${productId}`);
    return res.data;
  },

  getModel: async (productId: string) => {
    const res = await axiosInstance.get(`/vto/${productId}`);
    return res.data;
  },

  saveCalibration: async (productId: string, calibrationData: any) => {
    const res = await axiosInstance.put(`/vto/${productId}/calibration`, calibrationData);
    return res.data;
  },

};