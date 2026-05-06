'use client';

import { useEffect, useState } from "react";
import { userService } from "@/services/user.service";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<any>({});
  const router = useRouter();

  useEffect(() => {
    userService.getProfile().then(res => {
      setUser(res.data);
    });
  }, []);

  return (
    <div className="container mt-5 d-flex justify-content-center">
      {/* Profile Card Container */}
      <div className="card border-0 shadow-lg" style={{ width: "450px", borderRadius: "15px", overflow: "hidden" }}>

        <div style={{ 
          height: "120px", 
          backgroundImage: "linear-gradient(to bottom, #a1c4fd 0%, #c2e9fb 100%)", /* 替换为你喜欢的背景图或渐变 */
          backgroundSize: "cover" 
        }}></div>

        <div className="text-center" style={{ marginTop: "-50px" }}>
          <div className="bg-secondary d-inline-flex align-items-center justify-content-center rounded-circle border border-4 border-white shadow-sm" 
               style={{ width: "100px", height: "100px" }}>
            <i className="bi bi-person-fill text-white" style={{ fontSize: "3rem" }}></i>
          </div>
          <h4 className="mt-2 fw-bold text-dark">{user.username || "User0001"}</h4>
        </div>

        <div className="card-body px-4 pb-4">
          <div className="mb-3 text-start">
            <label className="form-label text-muted small fw-bold">Email</label>
            <input 
              className="form-control border-0 bg-light" 
              style={{ padding: "12px", borderRadius: "8px" }} 
              value={user.email || ""} 
              disabled 
            />
          </div>

          <div className="mb-4 text-start">
            <label className="form-label text-muted small fw-bold">Gender</label>
            <div className="position-relative">
            <input 
              className="form-control border-0 bg-light" 
              style={{ padding: "12px", borderRadius: "8px" }} 
              value={user.gender || ""} 
              disabled 
            />
            </div>
          </div>

          <button
            className="btn btn-info w-100 text-white fw-bold py-2 shadow-sm"
            style={{ backgroundColor: "#4ebce3", borderColor: "#4ebce3", borderRadius: "8px" }}
            onClick={() => router.push("/customer/edit-profile")}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}