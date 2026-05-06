import axiosInstance from './axios-instance';

const BASE_URL = '/bookings';

export const bookingService = {
  getAllBookings: () => axiosInstance.get(BASE_URL),

  getBookingById: (id: string) => axiosInstance.get(`${BASE_URL}/${id}`),

  getBookingsByUserId: (userId: string) => axiosInstance.get(`${BASE_URL}/customer/${userId}`),

  createBooking: (data: any) => axiosInstance.post(BASE_URL, data),

  updateBooking: (id: string, data: any) => axiosInstance.put(`${BASE_URL}/${id}`, data),
};