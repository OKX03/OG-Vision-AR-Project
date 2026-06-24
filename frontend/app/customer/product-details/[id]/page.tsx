"use client";

import React, { useEffect, useState } from "react";
import { Product } from "@/types/product";
import { useParams, useRouter } from "next/navigation";
import { Button, Modal } from "react-bootstrap";
import { userService } from "@/services/user.service";
import { productService } from "@/services/product.service";
import { bookingService } from "@/services/booking.service";
import namer from "color-namer";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../product-details.css";

export default function UserProductDetails() {
  const router = useRouter();
  const params = useParams();

  const productId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState("");

  const [showBooking, setShowBooking] = useState(false);
  const [productAvailable, setProductAvailable] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [showIncompleteDateTime, setShowIncompleteDateTime] = useState(false);
  const [showExceedBookingLimit, setShowExceedBookingLimit] = useState(false);
  const [showDuplicateBooking, setShowDuplicateBooking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [canBookNow, setCanBookNow] = useState(true);

  const getCurrentUserId = () => {
    try {
      const authUser = sessionStorage.getItem("auth-user");
      console.log("Auth user from sessionStorage:", authUser);
      if (!authUser) return null;
      return JSON.parse(authUser).id;
    } catch {
      return null;
    }
  };

  const currentUserId = getCurrentUserId();

  const businessHours: Record<string, { open: string; close: string } | null> = {
    monday: { open: "10:30", close: "19:00" },
    tuesday: { open: "10:30", close: "19:00" },
    wednesday: { open: "10:30", close: "19:00" },
    thursday: { open: "10:30", close: "19:00" },
    friday: { open: "10:30", close: "19:00" },
    saturday: { open: "10:30", close: "18:00" },
    sunday: null,
  };

  const getDayKey = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  };

  useEffect(() => {
    fetchProduct();
    if (currentUserId) fetchUserBookings();
  }, [productId]);

  useEffect(() => {
    const checkStoreStatus = () => {
      const now = new Date();
      now.setHours(17, 1, 0, 0);  
      const dayKey = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
      const hours = businessHours[dayKey];
      
      if (!hours) {
        setCanBookNow(false);
        return;
      }
      
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      
      const [openH, openM] = hours.open.split(":").map(Number);
      const openTotalMinutes = openH * 60 + openM;
      
      const [closeH, closeM] = hours.close.split(":").map(Number);
      const cutoffTotalMinutes = (closeH - 1) * 60 + closeM;
      
      if (currentTotalMinutes >= openTotalMinutes && currentTotalMinutes < cutoffTotalMinutes) {
        setCanBookNow(true);
      } else {
        setCanBookNow(true);
      }
    };

    checkStoreStatus();
    const interval = setInterval(checkStoreStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserBookings = async () => {
    try {
      const res = await bookingService.getBookingsByUserId(currentUserId);
      console.log("User bookings:", res.data);
      setUserBookings(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProduct = async () => {
    if (!productId) return;
    try {
      const res = await productService.getProductById(productId);
      const data = res.data;

      const colorName = data.color ? namer(data.color).ntc[0].name : "";

      const frontImage = getImageByView(data.images, "front");
      const sideImage = getImageByView(data.images, "side");

      const productData: Product = {
        product_id: data.product_id,
        brand: data.brand,
        model: data.model,
        price: Number(data.price),
        gender: data.gender,
        color: data.color,
        colorName: colorName,
        frameShape: data.frame_shape,
        frameMaterial: data.frame_material,
        faceShape: data.face_shape ? data.face_shape.split("_") : [],
        frameSize: data.frame_size,
        lensWidth: data.lens_width,
        lensHeight: data.lens_height,
        bridgeWidth: data.bridge_width,
        templeLength: data.temple_length,
        description: data.description || "",
        frontImage: frontImage,
        sideImage: sideImage,
        arModel: data.ar_model ? data.ar_model.file_path : null,
        quantity: data.quantity,
      };

      if (productData.quantity !== undefined && productData.quantity <= 0) {
        setProductAvailable(false);
      }

      setProduct(productData);
      setSelectedImage(productData.frontImage || "");
    } catch (err) {
      console.error(err);
    }
  };

  const getImageByView = (images: any[], viewType: string) => {
    const img = images?.find((i) => i.view_type === viewType);
    return img ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${img.image_url}` : "";
  };

  const tryOn = () => {
    if (product?.product_id) {
      router.push(`/customer/virtual-try-on?product_id=${product.product_id}`);
    }
  };

  const handleOpenBookingModal = async () => {
    try {

      const statusRes = await userService.getUserStatus();
      const realTimeStatus = statusRes.data.status;

      if (realTimeStatus === "Banned") {
        const authUser = JSON.parse(sessionStorage.getItem("auth-user") || "{}");
        authUser.status = "Banned";
        sessionStorage.setItem("auth-user", JSON.stringify(authUser));

        setShowBannedModal(true);
        return;
      }
    } catch (err) {
      console.error("Failed to check user status", err);
      alert("Network error, please try again.");
      return;
    }

    const activeBookings = userBookings.filter(
      (b) => b.status === "Pending" || b.status === "Accepted"
    );

    if (activeBookings.length >= 3) {
      setShowExceedBookingLimit(true);
      return;
    }

    const alreadyBooked = activeBookings.some(
      (b) => b.product_id === product?.product_id
    );
    if (alreadyBooked) {
      setShowDuplicateBooking(true);
      return;
    }

    setShowBooking(true);
  };

  const handleCloseBookingModal = () => {
    setShowBooking(false);
    setSelectedDate(null);
    setBookingDate("");
    setSelectedTime("");
    setAvailableTimes([]);
    setBlockedTimes([]);
    setShowIncompleteDateTime(false);
  };

  const isSunday = (date: Date) => date.getDay() === 0;

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 3);

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleBookingDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setBookingDate(date);

    const dayKey = getDayKey(date);
    const hours = businessHours[dayKey];

    if (!hours) {
      setAvailableTimes([]);
      setSelectedTime("");
      return;
    }

    const slots = generateTimeSlots(hours.open, hours.close);

    try {
      const res = await bookingService.getAllBookings();

      const sameDay = res.data.filter(
        (b: any) => b.booking_date.split("T")[0] === date
      );

      const approvedBookings = sameDay.filter(
        (b: any) => b.status === "Pending" || b.status === "Accepted"
      );

      const count: Record<string, number> = {};

      approvedBookings.forEach((b: any) => {
        count[b.time_slot] = (count[b.time_slot] || 0) + 1;
      });

      const blocked = Object.keys(count).filter((t) => count[t] >= 5);

      setBlockedTimes(blocked);

    } catch (err) {
      console.error(err);
    }

    setAvailableTimes(slots);
    setSelectedTime("");
  };

  const generateTimeSlots = (open: string, close: string) => {
    const slots: string[] = [];

    let [hour, minute] = open.split(":").map(Number);
    const [closeHour, closeMinute] = close.split(":").map(Number);

    if (minute !== 0) {
      const firstEndHour = hour + 1;
      slots.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} - ${String(firstEndHour).padStart(2, "0")}:00`
      );
      hour = firstEndHour;
      minute = 0;
    }

    while (hour < closeHour || (hour === closeHour && 0 < closeMinute)) {
      const start = `${String(hour).padStart(2, "0")}:00`;
      let endHour = hour + 1;
      let endMinute = 0;
      if (endHour > closeHour || (endHour === closeHour && endMinute > closeMinute)) break;
      const end = `${String(endHour).padStart(2, "0")}:00`;
      slots.push(`${start} - ${end}`);
      hour += 1;
    }

    return slots;
  };

  const onSubmit = () => {
    if (!bookingDate || !selectedTime) {
      setShowIncompleteDateTime(true)
      return;
    }
    setShowConfirm(true);
  };

  const confirmBooking = async () => {
    setShowConfirm(false);

    try {
      await bookingService.createBooking({
        user_id: currentUserId,
        product_id: product?.product_id,
        booking_date: bookingDate,
        time_slot: selectedTime,
      });

      setShowSuccess(true);
      handleCloseBookingModal();

      fetchUserBookings();

    } catch (err) {
      console.error(err);
      alert("Booking failed");
    }
  };


  if (!product) return <div className="text-center py-5">Loading...</div>;

  return (
    <div className="container py-5">

      <div className="d-flex align-items-center mb-4">
          <button className="btn btn-dark" onClick={() => router.back()}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <span className="ms-2 text-muted fw-semibold text-uppercase small cursor-pointer">Back</span>
      </div>

      <div className="row g-5">

        <div className="col-lg-7">
          <div className="bg-light rounded d-flex align-items-center justify-content-center position-relative main-image">
            <img src={selectedImage} className="img-fluid main-img" />

            {product.arModel && (
              <button
                className="btn btn-light shadow-sm position-absolute top-0 end-0 m-3 d-flex align-items-center gap-2"
                onClick={tryOn}
              >
                <i className="bi bi-person-video2"></i>
                Try On
              </button>
            )}
          </div>

          <div className="d-flex gap-3 mt-3">
            {product.frontImage && (
              <img
                src={product.frontImage}
                className={`thumb ${selectedImage === product.frontImage ? "active" : ""}`}
                onClick={() => setSelectedImage(product.frontImage!)}
              />
            )}

            {product.sideImage && (
              <img
                src={product.sideImage}
                className={`thumb ${selectedImage === product.sideImage ? "active" : ""}`}
                onClick={() => setSelectedImage(product.sideImage!)}
              />
            )}
          </div>
        </div>

        <div className="col-lg-5">

          <div className="mb-3 text-uppercase text-muted small fw-semibold">
            {product.brand}
          </div>

          <h2 className="fw-bold">{product.model}</h2>

          <div className="fs-3 fw-bold my-3">
            RM {product.price?.toFixed(2)}
          </div>

          {productAvailable ? (
            canBookNow ? (
              <div className="mb-4">
                <button
                  className="btn btn-primary mb-1"
                  onClick={handleOpenBookingModal}
                >
                  Love it? Reserve Now
                </button>

                <p className="text-muted small mb-3">
                  Reserve this item for up to 3 days for physical try-on.
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <button
                  className="btn btn-secondary mb-1"
                  disabled
                >
                  Booking Closed
                </button>
                <p className="text-muted small mb-3">
                  Booking is closed. Please come back during operating hours.
                </p>
              </div>
            )
          ) : (
            <div className="mb-4">
              <button
                className="btn btn-secondary mb-1"
                disabled
              >
                Out of Stock
              </button>
              <p className="text-muted small mb-3">
                This item is currently out of stock. Please check back later.
              </p>
            </div>
          )}


          <hr />

          <div className="row mb-3">
            <div className="col-4 text-muted small">Color</div>
            <div className="col-8 d-flex align-items-center gap-2">
              <span
                className="color-dot"
                style={{ backgroundColor: product.color }}
              ></span>
              <span>{product.colorName}</span>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-4 text-muted small">Frame Shape</div>
            <div className="col-8">
              <div>{product.frameShape}</div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-4 text-muted small">Frame Material</div>
            <div className="col-8">
              <div>{product.frameMaterial}</div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-4 text-muted small">Frame Size</div>
            <div className="col-8">
              <div>{product.frameSize}</div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <span className="badge bg-light text-dark">Lens: {product.lensWidth}mm x {product.lensHeight}mm</span>
                <span className="badge bg-light text-dark">Bridge: {product.bridgeWidth}mm</span>
                <span className="badge bg-light text-dark">Temple: {product.templeLength}mm</span>
              </div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-4 text-muted small">Suitable Face Shapes</div>
            <div className="col-8 d-flex flex-wrap gap-2">
              {product.faceShape?.map((shape) => (
                <span key={shape} className="badge bg-dark">
                  {shape}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      <div className="mt-5 pt-4 border-top">
        <h5 className="fw-bold text-uppercase mb-3">Product Description</h5>
        <p className="text-muted">{product.description}</p>
      </div>

      <Modal show={showBooking} onHide={handleCloseBookingModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Book a Try-On Slot</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-3">
            <label className="form-label d-block">Select Date</label>

            <DatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => {
                setSelectedDate(date);

                if (date) {
                  const formatted = formatDateLocal(date);
                  setBookingDate(formatted);

                  handleBookingDateChange({
                    target: { value: formatted }
                  } as any);
                }
              }}
              minDate={minDate}
              maxDate={maxDate}
              filterDate={(date) => !isSunday(date)}
              placeholderText="Select booking date"
              className="form-control w-100"
              dateFormat="dd-MM-yyyy"
            />
          </div>

          {availableTimes.length > 0 && (
            <div className="mb-3">
              <label className="form-label">Select Time Slot</label>

              <select
                className="form-select"
                value={selectedTime || ""}
                onChange={(e) => setSelectedTime(e.target.value)}
              >
                <option value="">-- Select Time Slot --</option>

                {availableTimes.map((t) => {
                  const isBlocked = blockedTimes.includes(t);

                  return (
                    <option key={t} value={t} disabled={isBlocked}>
                      {t} {isBlocked ? "(Unavailable)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {availableTimes.length === 0 && bookingDate && (
            <p className="text-danger">Closed on selected day</p>
          )}

        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseBookingModal}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={!selectedDate || !selectedTime}
          >
            Book Now
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showConfirm} centered onHide={() => setShowConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Booking Details</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* Booking Summary Section */}
          <div className="mb-4 px-2">
            <div className="row mb-2">
              <div className="col-4 text-muted small">Product</div>
              <div className="col-8 fw-semibold">{product?.brand} - {product?.model}</div>
            </div>
            <div className="row mb-2">
              <div className="col-4 text-muted small">Date</div>
              <div className="col-8 fw-semibold">{bookingDate ? bookingDate.split('-').reverse().join('-') : ''}</div>
            </div>
            <div className="row mb-2">
              <div className="col-4 text-muted small">Time</div>
              <div className="col-8 fw-semibold">{selectedTime}</div>
            </div>
          </div>

          {/* Policy Reminder Section */}
          <div className="alert alert-warning mb-0" style={{ fontSize: '0.85rem' }}>
            <p className="fw-bold mb-2">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              Important Reminder
            </p>
            <ul className="mb-0 ps-3">
              <li className="mb-1">Cancellation must be made at least <strong>24 hours</strong> before the booking date and time once the booking is accepted by the admin.</li>
              <li>Accumulating <strong>three (3) no-shows</strong> will result in your account being banned from making future bookings.</li>
            </ul>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={confirmBooking}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showBannedModal} centered onHide={() => setShowBannedModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Account Banned</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-4">
          <div className="text-danger mb-3">
            <i className="bi bi-ban" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Your account has been banned.</h5>
          <p>You are currently unable to make new bookings.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBannedModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showIncompleteDateTime} centered onHide={() => setShowIncompleteDateTime(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-warning mb-3">
            <i className="bi bi-exclamation-circle" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Select a date and time!</h5>
          <Button variant="danger" className="px-4" onClick={() => setShowIncompleteDateTime(false)}>
            Close
          </Button>
        </Modal.Body>
      </Modal>

      <Modal show={showDuplicateBooking} centered onHide={() => setShowDuplicateBooking(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-warning mb-3">
            <i className="bi bi-exclamation-circle" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>You already booked this product!</h5>
          <Button variant="danger" className="px-4" onClick={() => setShowDuplicateBooking(false)}>
            Close
          </Button>
        </Modal.Body>
      </Modal>

      <Modal show={showExceedBookingLimit} centered onHide={() => setShowExceedBookingLimit(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-warning mb-3">
            <i className="bi bi-exclamation-circle" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>You have exceeded the booking limit!</h5>
          <p className="text-muted">Only maximum 3 active bookings allowed</p>
          <Button variant="danger" className="px-4" onClick={() => setShowExceedBookingLimit(false)}>
            Close
          </Button>
        </Modal.Body>
      </Modal>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Booking Successfully Made!</h5>
          <p className="text-muted">You may wait for the admin to approve your booking.</p>
          <Button
            className="btn btn-success mt-3 px-5"
            onClick={() => {
              setShowSuccess(false);
            }}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>

    </div>
  );
}