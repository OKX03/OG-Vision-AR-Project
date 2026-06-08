'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { productService } from '@/services/product.service';
import namer from 'color-namer';
import { Modal, Button } from 'react-bootstrap';

export default function AddProductPage() {
  const router = useRouter();

  const [newProduct, setNewProduct] = useState({
    brand: '',
    model: '',
    price: 0,
    gender: '',
    color: '',
    frameShape: '',
    frameMaterial: '',
    lensWidth: 0,
    lensHeight: 0,
    bridgeWidth: 0,
    templeLength: 0,
    description: '',
    quantity: 0
  });

  const [errors, setErrors] = useState<any>({});
  const [selectedFaceShapes, setSelectedFaceShapes] = useState<string[]>([]);
  const [colorName, setColorName] = useState('');

  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [sideImage, setSideImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [sidePreview, setSidePreview] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFileError, setShowFileError] = useState(false);

  const faceShapeOptions = ['Oval', 'Round', 'Square', 'Heart', 'Oblong'];

  const handleChange = (field: string, value: any) => {
    setNewProduct({ ...newProduct, [field]: value });
    setErrors((prev: any) => ({ ...prev, [field]: '' }));
  };

  const updateColorName = (color: string) => {
    setColorName(color ? namer(color).ntc[0].name : '');
  };

  const toggleFaceShape = (shape: string, checked: boolean) => {
    if (checked) {
      setSelectedFaceShapes([...selectedFaceShapes, shape]);
    } else {
      const updated = selectedFaceShapes.filter(s => s !== shape);
      setSelectedFaceShapes(updated);
    }
  };

  const calculateFrameSize = (lensWidth: number) => {
    if (lensWidth === 0) return "";
    if (lensWidth < 49) return "Small";
    if (lensWidth >= 49 && lensWidth <= 54) return "Medium";
    if (lensWidth >= 55 && lensWidth <= 58) return "Large";
    if (lensWidth > 58) return "Extra Large";
    return "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'side') => {
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (!validTypes.includes(file.type)) {
      setShowFileError(true);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (type === 'front') {
        setFrontPreview(reader.result as string);
        setFrontImage(file);
      }
      else {
        setSidePreview(reader.result as string);
        setSideImage(file);
      }
    };

    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const errors: any = {};

    if (!newProduct.brand) errors.brand = 'Brand is required';
    if (!newProduct.model) errors.model = 'Model is required';
    if (newProduct.price <= 0) errors.price = 'Price must be > 0';
    if (!newProduct.gender) errors.gender = 'Gender required';
    if (!newProduct.color) errors.color = 'Color required';
    if (!newProduct.frameShape) errors.frameShape = 'Frame shape required';
    if (!newProduct.frameMaterial) errors.frameMaterial = 'Frame material required';
    if (selectedFaceShapes.length === 0) errors.faceShape = 'Select at least 1 face shape';

    if (newProduct.lensWidth < 1) errors.lensWidth = 'Minimum 1 mm';
    if (newProduct.lensHeight < 1) errors.lensHeight = 'Minimum 1 mm';
    if (newProduct.bridgeWidth < 1) errors.bridgeWidth = 'Minimum 1 mm';
    if (newProduct.templeLength < 1) errors.templeLength = 'Minimum 1 mm';

    if (!newProduct.description) errors.description = 'Description required';

    if (newProduct.quantity < 0) errors.quantity = "Quantity must be >= 0";

    if (!(frontImage)) errors.frontImage = 'Front image required';
    if (!(sideImage)) errors.sideImage = 'Side image required';

    setErrors(errors);

    return (
      Object.keys(errors).length === 0 &&
      frontImage &&
      sideImage &&
      selectedFaceShapes.length > 0
    );
  };

  const onSubmit = () => {
    const valid = validateForm();
    if (!valid) {
      setShowIncomplete(true);
      return;
    }
    setShowConfirm(true);
  };

  const confirmAddProduct = async () => {
    const frameSize = calculateFrameSize(newProduct.lensWidth);

    const formData = new FormData();
    // formData.append('product_id', productId);
    formData.append('brand', newProduct.brand);
    formData.append('model', newProduct.model);
    formData.append('price', newProduct.price.toString());
    formData.append('gender', newProduct.gender);
    formData.append('color', newProduct.color);
    formData.append('frame_shape', newProduct.frameShape);
    formData.append('frame_material', newProduct.frameMaterial);
    formData.append('face_shape', selectedFaceShapes.join('_'));
    formData.append('frame_size', frameSize);
    formData.append('lens_width', newProduct.lensWidth.toString());
    formData.append('lens_height', newProduct.lensHeight.toString());
    formData.append('bridge_width', newProduct.bridgeWidth.toString());
    formData.append('temple_length', newProduct.templeLength.toString());
    formData.append('description', newProduct.description);
    formData.append('quantity', newProduct.quantity.toString());

    if (frontImage) formData.append('front_image', frontImage);
    if (sideImage) formData.append('side_image', sideImage);

    try {
      await productService.createProduct(formData);
      setShowConfirm(false);
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Failed to add product');
    }
  };

  return (
    <div className="container mt-5 mb-5">
      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <button className="btn btn-dark" onClick={() => router.back()}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <h2 className="h4 mb-0 fw-bold">Add New Product</h2>
          </div>
        </div>

        <div className="card-body p-4">
          <h5 className="mb-3 text-secondary fw-semibold">Basic Information</h5>
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <label className="form-label fw-medium">Brand <span className='text-danger'>*</span></label>
              <input
                className={`form-control ${errors.brand ? 'is-invalid' : ''}`}
                value={newProduct.brand}
                onChange={e => handleChange('brand', e.target.value)}
              />
              <div className="invalid-feedback">{errors.brand}</div>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-medium">Model <span className='text-danger'>*</span></label>
              <input
                className={`form-control ${errors.model ? 'is-invalid' : ''}`}
                value={newProduct.model}
                onChange={e => handleChange('model', e.target.value)}
              />
              <div className="invalid-feedback">{errors.model}</div>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-medium">Price <span className='text-danger'>*</span></label>
              <div className="input-group">
                <span className="input-group-text">RM</span>
                <input
                  type="number"
                  className={`form-control ${errors.price ? 'is-invalid' : ''}`}
                  value={newProduct.price}
                  onChange={e => handleChange('price', Number(e.target.value))}
                />
              </div>
              <div className="invalid-feedback d-block">{errors.price}</div>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-medium">Gender <span className='text-danger'>*</span></label>
              <select
                className={`form-select ${errors.gender ? 'is-invalid' : ''}`}
                value={newProduct.gender}
                onChange={e => handleChange('gender', e.target.value)}
              >
                <option value="">Select Gender</option>
                <option>Men</option>
                <option>Women</option>
                <option>Unisex</option>
              </select>
              <div className="invalid-feedback">{errors.gender}</div>
            </div>
          </div>

          <hr className="my-4" />

          <h5 className="mb-3 text-secondary fw-semibold">Specifications</h5>
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <label className="form-label fw-medium">Frame Color <span className='text-danger'>*</span></label>
              <div className="d-flex align-items-center gap-2">
                <input
                  type="color"
                  className={`form-control form-control-color ${errors.color ? 'is-invalid' : ''}`}
                  value={newProduct.color}
                  onChange={(e) => {
                    handleChange('color', e.target.value);
                    updateColorName(e.target.value);
                  }}
                />
                <span className="badge bg-secondary">{colorName || 'Select color'}</span>
              </div>
              <div className="invalid-feedback d-block">{errors.color}</div>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-medium">Frame Shape <span className='text-danger'>*</span></label>
              <select
                className={`form-select ${errors.frameShape ? 'is-invalid' : ''}`}
                value={newProduct.frameShape}
                onChange={e => handleChange('frameShape', e.target.value)}
              >
                <option value="">Select</option>
                <option>Square</option>
                <option>Rectangle</option>
                <option>Round</option>
                <option>Browline</option>
                <option>Wayfarer</option>
              </select>
              <div className="invalid-feedback">{errors.frameShape}</div>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-medium">Frame Material <span className='text-danger'>*</span></label>
              <select
                className={`form-select ${errors.frameMaterial ? 'is-invalid' : ''}`}
                value={newProduct.frameMaterial}
                onChange={e => handleChange('frameMaterial', e.target.value)}
              >
                <option value="">Select</option>
                <option>Plastic</option>
                <option>Metal</option>
                <option>Acetate</option>
              </select>
              <div className="invalid-feedback">{errors.frameMaterial}</div>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-medium">Face Shape Recommendation <span className='text-danger'>*</span></label>
              {faceShapeOptions.map(shape => (
                <div className="form-check" key={shape}>
                  <input
                    type="checkbox"
                    className={`form-check-input ${errors.faceShape ? 'is-invalid' : ''}`}
                    checked={selectedFaceShapes.includes(shape)}
                    onChange={(e) => toggleFaceShape(shape, e.target.checked)}
                  />
                  <label className="form-check-label">{shape}</label>
                </div>
              ))}
              <div className="invalid-feedback d-block">{errors.faceShape}</div>
            </div>
          </div>

          {/* SIZE SECTION */}
          <div className="row g-3 mb-4 bg-light p-3 rounded border">
            <div className="col-md-3">
              <label>Lens Width (mm) <span className='text-danger'>*</span></label>
              <input
                type="number"
                className={`form-control ${errors.lensWidth ? 'is-invalid' : ''}`}
                value={newProduct.lensWidth}
                onChange={e => handleChange('lensWidth', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <div className="invalid-feedback">{errors.lensWidth}</div>
            </div>
            <div className="col-md-3">
              <label>Lens Height (mm) <span className='text-danger'>*</span></label>
              <input
                type="number"
                className={`form-control ${errors.lensHeight ? 'is-invalid' : ''}`}
                value={newProduct.lensHeight}
                onChange={e => handleChange('lensHeight', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <div className="invalid-feedback">{errors.lensHeight}</div>
            </div>
            <div className="col-md-3">
              <label>Bridge Width (mm) <span className='text-danger'>*</span></label>
              <input
                type="number"
                className={`form-control ${errors.bridgeWidth ? 'is-invalid' : ''}`}
                value={newProduct.bridgeWidth}
                onChange={e => handleChange('bridgeWidth', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <div className="invalid-feedback">{errors.bridgeWidth}</div>
            </div>
            <div className="col-md-3">
              <label>Temple Length (mm) <span className='text-danger'>*</span></label>
              <input
                type="number"
                className={`form-control ${errors.templeLength ? 'is-invalid' : ''}`}
                value={newProduct.templeLength}
                onChange={e => handleChange('templeLength', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <div className="invalid-feedback">{errors.templeLength}</div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="mb-4">
            <label className="form-label fw-medium">Description <span className='text-danger'>*</span></label>
            <textarea
              rows={3}
              className={`form-control ${errors.description ? 'is-invalid' : ''}`}
              value={newProduct.description}
              onChange={e => handleChange('description', e.target.value)}
            />
            <div className="invalid-feedback">{errors.description}</div>
          </div>

          {/* IMAGE UPLOAD */}
          <div className="row g-3 mb-5">
            <div className="col-md-6">
              <label className="form-label fw-bold">Front View Image <span className='text-danger'>*</span></label>
              <input
                type="file"
                className={`form-control ${errors.frontImage ? 'is-invalid' : ''}`}
                accept="image/jpg, image/jpeg, image/png"
                onChange={(e) => handleFileSelect(e, 'front')}
              />

              <div className="invalid-feedback">
                {errors.frontImage}
              </div>

              {frontPreview && (
                <img
                  src={frontPreview}
                  className="img-fluid rounded mt-2 border"
                  style={{ maxHeight: 180 }}
                  alt="Front Preview"
                />
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label fw-bold">Side View Image <span className='text-danger'>*</span></label>
              <input
                type="file"
                className={`form-control ${errors.sideImage ? 'is-invalid' : ''}`}
                accept="image/jpg, image/jpeg, image/png"
                onChange={(e) => handleFileSelect(e, 'side')}
              />

              <div className="invalid-feedback">
                {errors.sideImage}
              </div>

              {sidePreview && (
                <img
                  src={sidePreview}
                  className="img-fluid rounded mt-2 border"
                  style={{ maxHeight: 180 }}
                  alt="Side Preview"
                />
              )}
            </div>
          </div>

          <hr className="my-4" />

          <h5 className="mb-3 text-secondary fw-semibold">Inventory</h5>

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <label className="form-label fw-medium">
                Quantity <span className='text-danger'>*</span>
              </label>
              <input
                type="number"
                className={`form-control ${errors.quantity ? 'is-invalid' : ''}`}
                value={newProduct.quantity}
                onChange={e => handleChange('quantity', e.target.value === '' ? '' : Number(e.target.value))}
                min={0}
              />
              <div className="invalid-feedback">{errors.quantity}</div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-3">
            <button className="btn btn-danger" onClick={() => router.back()}>
              Cancel
            </button>
            <button className="btn btn-success fw-bold" onClick={onSubmit}>
              Save
            </button>
          </div>
        </div>
      </div>

      <Modal show={showConfirm} centered onHide={() => setShowConfirm(false)}>
        <Modal.Header>
          <Modal.Title>Confirm Add Product</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          Are you sure to save this product?
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="success" onClick={confirmAddProduct}>Confirm</Button>
          <Button variant="danger" onClick={() => setShowConfirm(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showIncomplete} centered onHide={() => setShowIncomplete(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-warning mb-3">
            <i className="bi bi-exclamation-circle" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5>Required information is incomplete!</h5>
          <p className="text-muted">Please update the missing fields.</p>
          <Button variant="danger" onClick={() => setShowIncomplete(false)}>
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
          <p className="text-muted">Only <strong>.jpg, .jpeg,</strong> and <strong>.png</strong> files are supported for product images.</p>
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
          <h5>Product Successfully Saved!</h5>
          <Button
            className="btn btn-success mt-3 px-5"
            onClick={() => {
              setShowSuccess(false);
              router.push('/admin/product-list');
            }}
          >
            Okay
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}