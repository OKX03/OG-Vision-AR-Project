"use client";

import React, { useEffect, useState } from "react";
import { bookingService } from "@/services/booking.service";
import { Button, Modal, Badge } from "react-bootstrap";

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [filter, setFilter] = useState("ACTIVE");

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [targetBooking, setTargetBooking] = useState<any>(null);

  const [showSuccess, setShowSuccess] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const getUserId = () => {
    const user = sessionStorage.getItem("auth-user");
    return user ? JSON.parse(user).id : null;
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const userId = getUserId();
    if (!userId) return;

    const res = await bookingService.getBookingsByUserId(userId);
    setBookings(res.data);
    applyFilter("ACTIVE", res.data);
  };

  const applyFilter = (type: string, data = bookings) => {
    setFilter(type);

    let result = data;

    if (type === "ACTIVE") {
      result = data.filter(
        (b) => b.status === "Pending" || b.status === "Accepted"
      );
    }

    if (type === "HISTORY") {
      result = data.filter(
        (b) =>
          b.status === "Cancelled" ||
          b.status === "Rejected" ||
          b.status === "Completed"
      );
    }

    setFiltered(result);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending": return "warning";
      case "Accepted": return "success";
      case "Rejected": return "danger";
      case "Cancelled": return "secondary";
      case "Completed": return "dark";
      default: return "light";
    }
  };

  const canCancel = (booking: any) => {
    if (booking.status === "Cancelled") return false;

    if (booking.status === "Pending") return true;

    if (booking.status === "Accepted") {
      try {
        const bookingDate = booking.booking_date.split("T")[0];

        const [start] = booking.time_slot.split("-");
        const startTime = start.trim();

        const startDateTime = new Date(`${bookingDate} ${startTime}`);
        const now = new Date();

        const diffHours =
          (startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        return diffHours >= 12;
      } catch {
        return false;
      }
    }

    return false;
  };

  const confirmCancel = async () => {
    if (!targetBooking) return;

    try {
      await bookingService.updateBooking(
        targetBooking.booking_id.toString(),
        {
          status: "Cancelled"
        }
      );

      setShowCancelModal(false);
      setShowSuccess(true);
      fetchBookings();

    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(filtered.length / pageSize);

  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="container py-4">
      <h3 className="mb-4">My Bookings</h3>

      <div className="mb-3">
        <Button
          variant={filter === "ACTIVE" ? "primary" : "outline-primary"}
          className="me-2"
          onClick={() => applyFilter("ACTIVE")}
        >
          Active
        </Button>

        <Button
          variant={filter === "HISTORY" ? "primary" : "outline-primary"}
          onClick={() => applyFilter("HISTORY")}
        >
          History
        </Button>
      </div>

      <table className="table table-hover">
        <thead>
          <tr>
            <th>Product</th>
            <th>Date</th>
            <th>Time</th>
            <th>Status</th>
            <th className="text-center">Action</th>
          </tr>
        </thead>

        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-muted py-4">
                No bookings found
              </td>
            </tr>
          ) : (
            paginated.map((b, i) => (
              <tr key={b.booking_id}>
                <td>
                  {(currentPage - 1) * pageSize + i + 1}.{" "}
                  {b.product?.brand} - {b.product?.model}
                </td>

                <td>
                  {new Date(b.booking_date).toLocaleDateString()}
                </td>

                <td>{b.time_slot}</td>

                <td>
                  <Badge bg={getStatusBadge(b.status)}>
                    {b.status}
                  </Badge>
                </td>

                <td className="text-center">
                  {canCancel(b) ? (
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => {
                        setTargetBooking(b);
                        setShowCancelModal(true);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <span className="text-muted small">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="text-muted small">
          Showing {paginated.length} of {filtered.length} bookings
        </div>

        <nav>
          <ul className="pagination pagination-sm mb-0">

            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              >
                Previous
              </button>
            </li>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <li
                key={page}
                className={`page-item ${page === currentPage ? "active" : ""}`}
              >
                <button
                  className="page-link"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              </li>
            ))}

            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() =>
                  setCurrentPage(p => Math.min(p + 1, totalPages))
                }
              >
                Next
              </button>
            </li>

          </ul>
        </nav>
      </div>

      <Modal show={showCancelModal} centered onHide={() => setShowCancelModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Cancel Booking</Modal.Title>
        </Modal.Header>

        <Modal.Body className="text-center">
          Are you sure you want to cancel this booking?
          <p className="text-muted small mt-2">
            Cancellation must be at least 24 hours before appointment.
          </p>
        </Modal.Body>

        <Modal.Footer className="justify-content-center">
          <Button variant="danger" onClick={confirmCancel}>
            Confirm Cancel
          </Button>
          <Button variant="light" onClick={() => setShowCancelModal(false)}>
            Back
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <h5>Booking Cancelled</h5>
          <Button onClick={() => setShowSuccess(false)}>OK</Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}