import axiosInstance from './axios-instance';

const BASE_URL = '/bookings';

export const bookingService = {
  // Fetches all bookings from the backend API.
  getAllBookings: () => axiosInstance.get(BASE_URL),

  // Fetches a specific booking by its ID.
  getBookingById: (id: string) => axiosInstance.get(`${BASE_URL}/${id}`),

  // Fetches all bookings associated with a specific user.
  getBookingsByUserId: (userId: string) => axiosInstance.get(`${BASE_URL}/user/${userId}`),

  // Submits a new booking request.
  createBooking: (data: any) => axiosInstance.post(BASE_URL, data),

  // Updates an existing booking (e.g., status changes).
  updateBooking: (id: string, data: any) => axiosInstance.put(`${BASE_URL}/${id}`, data),
};