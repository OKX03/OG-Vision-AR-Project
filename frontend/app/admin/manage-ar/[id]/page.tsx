"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Modal } from "react-bootstrap";
import * as THREE from "three";
import { GLTFLoader, FBXLoader, OrbitControls } from "three-stdlib";
import { VtoService } from "@/services/vto.service";
import VirtualTryOnCanvas from "@/components/virtual-try-on-canvas";

export default function ManageARPage() {
  const { id } = useParams();
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [productModel, setProductModel] = useState<any>(null); // To store current model DB entry
  const [showArCalibration, setShowArCalibration] = useState(false);

  const [showConfirmUpload, setShowConfirmUpload] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showFileError, setShowFileError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);

  const loaderGLTF = new GLTFLoader();
  const loaderFBX = new FBXLoader();

  const initThree = () => {
    const canvas = canvasRef.current!;
    const container = canvas.parentElement!;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0.5, 2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    window.addEventListener("resize", onResize);

    animate();
  };

  const onResize = () => {
    if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
    const canvas = canvasRef.current;
    const container = canvas.parentElement!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  };

  const animate = () => {
    requestAnimationFrame(animate);
    controlsRef.current?.update();
    if (sceneRef.current && cameraRef.current) {
      rendererRef.current?.render(sceneRef.current, cameraRef.current);
    }
  };

  const loadModel = (url: string) => {
    const ext = url.split(".").pop()?.toLowerCase();

    const onLoad = (object: THREE.Object3D) => {
      const scene = sceneRef.current!;
      if (modelRef.current) scene.remove(modelRef.current);

      const model = object instanceof THREE.Group ? object : new THREE.Group().add(object);

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z);
      const scale = 1.2 / maxAxis;

      model.scale.setScalar(scale);

      const newBox = new THREE.Box3().setFromObject(model);
      const center = newBox.getCenter(new THREE.Vector3());

      model.position.sub(center);
      scene.add(model);
      modelRef.current = model;
    };

    if (ext === "glb" || ext === "gltf") {
      loaderGLTF.load(url, (gltf) => onLoad(gltf.scene));
    } else if (ext === "fbx") {
      loaderFBX.load(url, (fbx) => onLoad(fbx));
    }
  };

  useEffect(() => {
    initThree();
    if (id) {
      VtoService.getModelByProductId(id as string).then((model: any) => {
        if (model?.file_path) {
          setProductModel(model);
          loadModel(`${process.env.NEXT_PUBLIC_API_BASE_URL}${model.file_path}`);
        }
      });
    }
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['glb', 'gltf', 'fbx'].includes(ext || '')) {
        setShowFileError(true);
        e.target.value = '';
        setSelectedFile(null);
        return;
      }
    }
    setSelectedFile(file);
  };

  const handleUploadClick = () => {
    if (!selectedFile) {
      setShowIncomplete(true);
      return;
    }
    setShowConfirmUpload(true);
  };

  const confirmUpload = async () => {
    if (!selectedFile) return;
    setShowConfirmUpload(false);
    setIsUploading(true);
    try {
      await VtoService.uploadModel(id as string, selectedFile);
      setSuccessMessage("AR Model Uploaded Successfully!");
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = () => {
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    setShowConfirmDelete(false);
    try {
      await VtoService.deleteModel(id as string);
      setSuccessMessage("AR Model Deleted Successfully!");
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  const handleSaveCalibration = async (calib: any) => {
    try {
      await VtoService.saveCalibration(id as string, calib);
      setSuccessMessage("Calibration Settings Saved Successfully!");
      setShowSuccess(true);
      setShowArCalibration(false);
      // Reload the model data
      VtoService.getModelByProductId(id as string).then(setProductModel);
    } catch (err) {
      console.error(err);
      alert("Failed to save calibration.");
    }
  };

  return (
    <div className="container py-4">
      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
          <Button
            variant="dark"
            size="sm"
            className="me-3"
            onClick={() => router.push("/admin/product-list")}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <h5 className="fw-bold mb-0">Manage AR Model</h5>
        </div>

        <div className="card-body p-4">
            <div className="mb-3">
              <input
                type="file"
                className="form-control"
                accept=".glb,.gltf,.fbx"
                onChange={handleFileChange}
              />
              <small className="text-muted mt-1 d-block">Supported formats: GLB, GLTF, FBX</small>
            </div>

            <div className="d-flex gap-2">
              <Button 
                className="fw-bold d-flex align-items-center justify-content-center" 
                style={{ minWidth: "160px" }}
                onClick={handleUploadClick}
                disabled={isUploading}
              >
                <i className="bi bi-upload me-2"></i>
                {isUploading ? "Uploading..." : "Upload Model"}
              </Button>

              <Button 
                variant="outline-danger" 
                className="fw-bold d-flex align-items-center justify-content-center"
                style={{ minWidth: "160px" }}
                onClick={handleDeleteClick}
              >
                <i className="bi bi-trash me-2"></i>
                Delete Model
              </Button>
            </div>


          <hr className="my-4" />

          <div>
            <h6 className="fw-bold mb-3 text-secondary">3D Model Preview</h6>
            <div
              className="border rounded-3 bg-light d-flex justify-content-center align-items-center overflow-hidden position-relative"
              style={{ height: "500px", width: "100%" }}
            >
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
              <div className="position-absolute bottom-0 end-0 p-2 text-muted small" style={{ pointerEvents: 'none' }}>
                <i className="bi bi-mouse me-1"></i> Drag to rotate • Scroll to zoom
              </div>
            </div>
          </div>

          {productModel?.file_path && (
            <>
              <hr className="my-4" />
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0 text-secondary">AR Model Calibration</h6>
                <Button variant={showArCalibration ? "danger" : "primary"} onClick={() => setShowArCalibration(!showArCalibration)}>
                  {showArCalibration ? "Exit Calibration" : "Calibrate AR Model"}
                </Button>
              </div>

              {showArCalibration && (
                <>
                  <div className="alert alert-info py-3 d-flex align-items-center mb-3 border-0 bg-light-info shadow-sm" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                    <i className="bi bi-info-circle-fill me-3 fs-4"></i>
                    <div>
                      <strong>Calibration Tips:</strong> Please wear the virtual glasses. Use the sliders on the left to adjust the Pitch, Yaw, Roll, Scale, and Offsets until the model sits perfectly on your face. Once done, save the calibration!
                    </div>
                  </div>
                  <div className="border border-3 rounded-3 overflow-hidden position-relative shadow-sm" style={{ width: "100%", background: "#f8f9fa", borderColor: "#e9ecef" }}>
                    <VirtualTryOnCanvas 
                      modelPath={`${process.env.NEXT_PUBLIC_API_BASE_URL}${productModel.file_path}`} 
                      isAdminMode={true}
                      initialCalibration={{
                        pitch: productModel.pitch ?? 0,
                        yaw: productModel.yaw ?? 0,
                        roll: productModel.roll ?? 0,
                        scale: productModel.scale ?? 1.0,
                        yOffset: productModel.y_offset ?? -0.01,
                        zOffset: productModel.z_offset ?? 0.05
                      }}
                      onSaveCalibration={handleSaveCalibration}
                    />
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </div>

      <Modal show={showConfirmUpload} centered onHide={() => setShowConfirmUpload(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Upload</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          Are you sure you want to upload <strong>{selectedFile?.name}</strong> as the AR model?
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="secondary" onClick={() => setShowConfirmUpload(false)}>Cancel</Button>
          <Button variant="success" className="px-4" onClick={confirmUpload}>Confirm</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showConfirmDelete} centered onHide={() => setShowConfirmDelete(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          Are you sure you want to delete the current AR model? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" className="px-4" onClick={confirmDelete}>Confirm</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showIncomplete} centered onHide={() => setShowIncomplete(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-warning mb-3">
            <i className="bi bi-exclamation-circle" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>No File Selected!</h5>
          <p className="text-muted">Please select an AR model file before uploading.</p>
          <Button variant="warning" className="text-white px-4" onClick={() => setShowIncomplete(false)}>
            Okay
          </Button>
        </Modal.Body>
      </Modal>

      <Modal show={showFileError} centered onHide={() => setShowFileError(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-danger mb-3">
            <i className="bi bi-file-earmark-x" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Invalid File Format!</h5>
          <p className="text-muted">Only <strong>.glb, .gltf,</strong> and <strong>.fbx</strong> files are supported for 3D preview.</p>
          <Button variant="danger" className="px-4" onClick={() => setShowFileError(false)}>
            Close
          </Button>
        </Modal.Body>
      </Modal>

      <Modal show={showSuccess} centered backdrop="static">
        <Modal.Body className="text-center p-4">
          <div className="text-success mb-3">
            <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>{successMessage}</h5>
          <Button
            className="btn btn-success mt-3 px-5"
            onClick={() => {
              setShowSuccess(false);
              window.location.reload();
            }}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}