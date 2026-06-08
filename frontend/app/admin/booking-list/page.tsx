'use client';

import React, { useEffect, useState } from "react";
import { bookingService } from "@/services/booking.service";
import { Modal, Button } from "react-bootstrap";
import moment from "moment";
import { Calendar, momentLocalizer } from "react-big-calendar";

const localizer = momentLocalizer(moment);

export default function BookingListPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const [showConfirm, setShowConfirm] = useState(false);
  const [showMissingReason, setShowMissingReason] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    id: number;
    status: string;
    noShowCount?: number;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date());

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const STATUS = [
    "ALL",
    "Pending",
    "Accepted",
    "Rejected",
    "Cancelled",
    "Expired",
    "No Show",
    "Completed"
  ];

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await bookingService.getAllBookings();
      setBookings(res.data);
      setFilteredBookings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const parseTime = (time: string) => {
    return time.replace(".", ":");
  };

  const events = filteredBookings
    .filter((b) => b.status === "Accepted")
    .map((b) => {
      const [start, end] = b.time_slot.split("-");

      return {
        title: `${b.user?.username} - ${b.product?.brand}`,
      start: new Date(`${b.booking_date} ${parseTime(start.trim())}`),
      end: new Date(`${b.booking_date} ${parseTime(end.trim())}`),
      resource: b
    };
  });

  const eventStyleGetter = (event: any) => {
    let bg = "#6c757d";

    switch (event.resource.status) {
      case "Accepted":
        bg = "#28a745";
        break;
      case "Pending":
        bg = "#ffc107";
        break;
      case "Rejected":
        bg = "#dc3545";
        break;
      case "Completed":
        bg = "#007bff";
        break;
    }

    return {
      style: {
        backgroundColor: bg,
        color: "white",
        borderRadius: "5px"
      }
    };
  };

  const applyFilter = (status: string, keyword: string) => {
    let data = [...bookings];

    if (status !== "ALL") {
      data = data.filter(b => b.status === status);
    }

    if (keyword) {
      data = data.filter(
        b =>
          b.user?.name?.toLowerCase().includes(keyword.toLowerCase()) ||
          b.product?.brand?.toLowerCase().includes(keyword.toLowerCase()) ||
          b.product?.model?.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    setFilteredBookings(data);
    setCurrentPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    applyFilter(status, searchText);
  };

  const handleSearch = (keyword: string) => {
    setSearchText(keyword);
    applyFilter(statusFilter, keyword);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <span className="badge" style={{ backgroundColor: "#fd7e14" }}>{status}</span>;
      case "Accepted":
        return <span className="badge bg-primary">{status}</span>;
      case "Completed":
        return <span className="badge bg-success">{status}</span>;
      case "Rejected":
        return <span className="badge bg-danger">{status}</span>;
      case "Cancelled":
        return <span className="badge bg-secondary">{status}</span>;
      case "Expired":
        return <span className="badge bg-dark">{status}</span>;
      case "No Show":
        return <span className="badge text-dark" style={{ backgroundColor: "#ffea00" }}>{status}</span>;
      default:
        return <span className="badge bg-light text-dark">{status}</span>;
    }
  };

  const onClick = async (booking: any, status: string) => {
    setConfirmAction({ id: booking.booking_id, status });
    setShowConfirm(true);

    if (status === "No Show" && booking.user_id) {
      try {
        const res = await bookingService.getBookingsByUserId(booking.user_id);
        const userBookings = res.data;
        const count = userBookings.filter((b: any) => b.status === "No Show").length;
        setConfirmAction({ id: booking.booking_id, status, noShowCount: count });
      } catch (err) {
        console.error("Failed to fetch no show count", err);
      }
    }
  };

  const getActionMessage = (status: string, noShowCount?: number) => {
    switch (status) {
      case "Accepted":
        return "Are you sure you want to accept this booking?";
      case "Rejected":
        return "Please provide a reason for rejecting this booking.";
      case "Completed":
        return "Mark this booking as completed?";
      case "No Show":
        if (noShowCount !== undefined) {
          return (
            <>
              Mark this booking as no show?
              <small className="text-muted d-block mt-2">
                This user has {noShowCount} no show records. Reaching 3 times will ban this account for booking.
              </small>
            </>
          );
        }
        return "Mark this booking as no show?";
      default:
        return "Are you sure to proceed?";
    }
  };

  const getSuccessMessage = (status: string) => {
    switch (status) {
      case "Accepted":
        return "Booking has been accepted!";
      case "Rejected":
        return "Booking has been rejected!";
      case "Completed":
        return "Booking marked as completed!";
      case "No Show":
        return "Booking marked as no show!";
      default:
        return "Status updated successfully!";
    }
  };

  const confirmUpdateStatus = async () => {
    if (!confirmAction) return;

    if (confirmAction.status === "Rejected" && !rejectReason.trim()) {
      setShowMissingReason(true);
      return;
    }

    try {
      await bookingService.updateBooking(confirmAction.id.toString(), {
        status: confirmAction.status,
        rejection_reason: confirmAction.status === "Rejected" ? rejectReason : null
      });

      setShowConfirm(false);
      setShowSuccess(true);
      setRejectReason("");
      fetchBookings();
    } catch (err) {
      console.error(err);
    }
  };

  const renderActions = (b: any) => {
    switch (b.status) {
      case "Pending":
        return (
          <div className="d-flex justify-content-center gap-2">
            <Button size="sm" variant="primary"
              onClick={() => onClick(b, "Accepted")}>
              Accept
            </Button>

            <Button size="sm" variant="danger"
              onClick={() => onClick(b, "Rejected")}>
              Reject
            </Button>
          </div>
        );

      case "Accepted":
      case "Expired":
        return (
          <div className="d-flex justify-content-center gap-2">
            <Button size="sm" variant="success"
              onClick={() => onClick(b, "Completed")}>
              Complete
            </Button>

            <Button size="sm"
              style={{ backgroundColor: "#ffea00", borderColor: "#ffea00", color: "#212529" }}
              onClick={() => onClick(b, "No Show")}>
              No Show
            </Button>
          </div>
        );

      default:
        return <div className="text-center text-muted">-</div>;
    }
  };

  const totalPages = Math.ceil(filteredBookings.length / pageSize);
  const paginated = filteredBookings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="container-fluid py-4">
      <div className="card shadow-sm border-0">

        <div className="mb-3">
          <h2 className="ms-2">Bookings</h2>

          <div className="btn-group ms-2 mb-3">
            <button
              className={`btn ${viewMode === "list" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setViewMode("list")}
            >
              <i className="bi bi-list me-1"></i> List
            </button>

            <button
              className={`btn ${viewMode === "calendar" ? "btn-dark" : "btn-outline-dark"}`}
              onClick={() => setViewMode("calendar")}
            >
              <i className="bi bi-calendar3 me-1"></i> Calendar
            </button>
          </div>

          {viewMode === "list" && (
            <>
              <input
                type="text"
                className="form-control ms-2 mb-3"
                style={{ maxWidth: "300px" }}
                placeholder="Search by user or product..."
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
              />

              <div className="d-flex flex-wrap gap-2 justify-content-end me-2 mb-2">
                {STATUS.map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-outline-primary"
                      }`}
                    onClick={() => handleStatusFilter(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {viewMode === "list" && (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>No</th>
                    <th>User</th>
                    <th>Contact Info</th>
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
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No bookings found
                      </td>
                    </tr>
                  ) : (
                    paginated.map((b, i) => (
                      <tr key={b.booking_id}>
                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                        <td>{b.user?.username}</td>
                        <td>
                          <div>{b.user?.email}</div>
                          {b.user?.phone_number && <div className="text-muted small"><i className="bi bi-telephone-fill me-1"></i>+60 {b.user.phone_number}</div>}
                        </td>
                        <td>{b.product?.brand} - {b.product?.model}</td>
                        <td>{b.booking_date}</td>
                        <td>{b.time_slot}</td>
                        <td>{getStatusBadge(b.status)}</td>
                        <td>{renderActions(b)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3 px-3 pb-3">
              <div className="text-muted small">
                Showing {paginated.length} of {filteredBookings.length}
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
          </>
        )}

        {viewMode === "calendar" && (
          <div style={{ height: 600 }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              views={['month']}
              date={currentDate}
              onNavigate={(newDate) => {
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                if (newDate >= currentMonthStart && newDate <= nextMonthEnd) {
                  setCurrentDate(newDate);
                }
              }}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event: any) => {
                setSelectedEvent(event.resource);
                setShowEventModal(true);
              }}
            />
          </div>
        )}

      </div>

      <Modal show={showEventModal} centered onHide={() => setShowEventModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Booking Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEvent && (
            <div className="p-2">
              <p className="mb-2"><strong>User:</strong> {selectedEvent.user?.username} ({selectedEvent.user?.email})</p>
              {selectedEvent.user?.phone_number && <p className="mb-2"><strong>Phone:</strong> +60 {selectedEvent.user.phone_number}</p>}
              <p className="mb-2"><strong>Product:</strong> {selectedEvent.product?.brand} - {selectedEvent.product?.model}</p>
              <p className="mb-2"><strong>Date:</strong> {selectedEvent.booking_date}</p>
              <p className="mb-2"><strong>Time:</strong> {selectedEvent.time_slot}</p>
              <p className="mb-0"><strong>Status:</strong> {getStatusBadge(selectedEvent.status)}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEventModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showConfirm} centered onHide={() => setShowConfirm(false)}>
        <Modal.Header>
          <Modal.Title>Confirm Action</Modal.Title>
        </Modal.Header>

        <Modal.Body className="text-center">

          <p>{confirmAction && getActionMessage(confirmAction.status, confirmAction.noShowCount)}</p>

          {confirmAction?.status === "Rejected" && (
            <textarea
              className="form-control mt-3"
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          )}

        </Modal.Body>

        <Modal.Footer className="justify-content-center">
          <Button variant="success" onClick={confirmUpdateStatus}>
            Confirm
          </Button>
          <Button variant="danger" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showMissingReason} centered onHide={() => setShowMissingReason(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-warning mb-3">
            <i className="bi bi-exclamation-circle" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Rejection reason is required!</h5>
          <p className="text-muted">Please enter a reason for rejection.</p>
          <Button variant="danger" onClick={() => setShowMissingReason(false)}>
            Okay
          </Button>
        </Modal.Body>
      </Modal>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>

          <h5>
            {confirmAction ? getSuccessMessage(confirmAction.status) : "Success!"}
          </h5>

          <Button
            className="btn btn-success mt-3 px-5"
            onClick={() => setShowSuccess(false)}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}