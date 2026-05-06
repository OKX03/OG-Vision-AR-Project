'use client';

import { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { userService } from "@/services/user.service";
import { useRouter } from "next/navigation";

export default function EditProfilePage() {
  const router = useRouter();  
  
  const [profileForm, setProfileForm] = useState({
    username: "",
    gender: "",
    email: ""
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);


  useEffect(() => {
    userService.getProfile().then(res => {
      setProfileForm({
        username: res.data.username,
        gender: res.data.gender,
        email: res.data.email
      });
    });
  }, []);

  const validateForm = () => {
    const newErrors: { username?: string; gender?: string } = {};
    if (!profileForm.username) newErrors.username = "Username is required";
    if (!profileForm.gender) newErrors.gender = "Gender is required";
    return newErrors;
  };

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault?.();
    setSubmitted(true);
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setShowConfirm(true);
    }
  };

  const confirmEdit = async () => {
    try {
      await userService.updateProfile(profileForm.username, profileForm.gender);
      setShowConfirm(false);
      setShowSuccess(true);
    } catch (err: any) {
      if (err.response?.data?.field) {
        setErrors({ [err.response.data.field]: err.response.data.message });
      }
      setShowConfirm(false);
    }
  }


  return (
    <div className="container mt-5 d-flex justify-content-center">
      <div className="card border-0 shadow-lg" style={{ width: "450px", borderRadius: "15px", overflow: "hidden" }}>

        <div style={{ 
          height: "120px", 
          backgroundImage: "linear-gradient(to bottom, #a1c4fd 0%, #c2e9fb 100%)", 
          backgroundSize: "cover" 
        }}></div>

        <div className="text-center" style={{ marginTop: "-50px" }}>
          <div className="bg-secondary d-inline-flex align-items-center justify-content-center rounded-circle border border-4 border-white shadow-sm" 
               style={{ width: "100px", height: "100px" }}>
            <i className="bi bi-person-fill text-white" style={{ fontSize: "3rem" }}></i>
          </div>

          <div className="mt-2 px-5 d-flex align-items-center justify-content-center position-relative">
            <input
              type="text"
              className={`form-control border-0 text-center fw-bold fs-5 bg-transparent p-0 ${submitted && errors.username ? "is-invalid" : ""}`}
              style={{ boxShadow: "none", color: "#333" }}
              value={profileForm.username}
              onChange={e => setProfileForm({ ...profileForm, username: e.target.value })}
            />
            <i className="bi bi-pencil-fill ms-2 text-muted" style={{ fontSize: "0.9rem" }}></i>
          </div>
          {submitted && errors.username && <div className="text-danger small mt-1">{errors.username}</div>}
        </div>

        <div className="card-body px-4 pb-4 mt-3">
          <div className="mb-3 text-start">
            <label className="form-label text-muted small fw-bold">Email</label>
            <input 
              className="form-control border-0 bg-light text-muted" 
              style={{ padding: "12px", borderRadius: "8px", cursor: "not-allowed" }} 
              value={profileForm.email || "user0001@gmail.com"} 
              disabled 
            />
          </div>

          <div className="mb-4 text-start">
            <label className="form-label text-muted small fw-bold">Gender</label>
            <select
              className={`form-select border-0 bg-light shadow-none ${submitted && errors.gender ? "is-invalid" : ""}`}
              style={{ padding: "12px", borderRadius: "8px" }}
              value={profileForm.gender}
              onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })}
            >
              <option value="">select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            {submitted && errors.gender && <div className="invalid-feedback">{errors.gender}</div>}
          </div>

          <div className="d-flex gap-3 mt-2">
            <button
                type="button"
                className="btn btn-danger w-50 fw-bold py-2 shadow-sm"
                style={{ borderRadius: "8px", border: "1px solid #ddd" }}
                onClick={() => router.push("/customer/profile")}
            >
                Cancel
            </button>
            
            <button
                className="btn btn-success w-50 text-white fw-bold py-2 shadow-sm"
                style={{ backgroundColor: "#52e68c", borderColor: "#52e68c", borderRadius: "8px" }}
                onClick={handleSubmit}
            >
                Save
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal show={showConfirm} centered onHide={() => setShowConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Edit</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          Are you sure you want to edit profile?
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="success" className="px-4" onClick={confirmEdit}>Confirm</Button>
          <Button variant="danger" onClick={() => setShowConfirm(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>    

      {/* Success Modal */}
      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Profile Edit Successful!</h5>
          <Button
            className="btn btn-dark mt-3 px-5"
            onClick={() => {
              setShowSuccess(false);
              router.push("/customer/profile");
            }}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}