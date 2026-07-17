# OG Vision AR Project

OG Vision AR Project is a final year project (FYP) that is a comprehensive web application that integrates Augmented Reality (AR) and Artificial Intelligence (AI) to provide an immersive virtual try-on experience for eyewear. It analyzes a user's face shape to recommend the best-fitting glasses and allows them to visualize the frames in real-time.

## Project Architecture

The project is structured into three main components:

### 1. Frontend (`/frontend`)
A modern, responsive user interface built with Next.js and React.
- **Framework:** Next.js (App Router), React
- **AR & 3D:** Three.js for rendering 3D glasses models.
- **Computer Vision:** MediaPipe (`@mediapipe/tasks-vision`) for real-time face landmark detection.
- **AI Face Shape Classification Inference:** ONNX Runtime Web (`onnxruntime-web`) to run the face shape classification model directly in the browser.
- **Styling:** Bootstrap
- **Key Folder Structure:**
  - `app/`: Next.js App Router directory defining all page routes and layouts (e.g., `/customer`, `/admin`).
  - `components/`: Reusable React UI components.
  - `services/`: API integration layers and heavy utility services.
  - `guard/`: Client-side route protection.
  - `types/`: Shared TypeScript type definitions and interfaces.  

### 2. Backend (`/backend`)
A robust REST API server that handles business logic, user authentication, and data management.
- **Framework:** Node.js, Express.js
- **Database ORM:** Sequelize (MySQL)
- **Authentication:** JWT (`jsonwebtoken`), bcryptjs
- **Storage:** Cloudflare R2 (for AR models), Cloudinary (for product images)
- **AI Integration:** Google Gemini API (`@google/generative-ai`) for the intelligent customer support chatbot.
- **Other:** Node-cron for scheduled tasks, Nodemailer for email notifications.
- **Key Folder Structure (`/backend/app/`):**
  - `models/`: Defines the database schema and relationships using Sequelize ORM.
  - `controllers/`: Handles incoming HTTP requests, processes input data, and returns API responses.
  - `routes/`: Maps specific URL endpoints to their corresponding controller functions.
  - `services/`: Encapsulates reusable business logic (e.g., email notifications).
  - `middleware/`: Intercepts requests for tasks like verifying JWT tokens, role authorization, and error handling.
  - `config/`: Database connections and environment variable configurations.
  - `cron/`: Scheduled automated tasks.   

### 3. Face Shape Classifier (`/face_shape_classifier`)
A Python-based machine learning pipeline to train and export models that classify human face shapes (Heart, Oblong, Oval, Round, Square).

- **`final_env/`**: The Python virtual environment used for installing dependencies and running the classification pipeline.
- **`dataset/`**: Contains the image data for training and testing (see Acknowledgments for source).
  - `raw/`: The original source dataset (contains `train` and `test` folders organized by face shape).
  - `split/`: Dataset systematically split into training, validation, and testing subsets.
  - `preprocessed_split/`: Data that has undergone preprocessing (e.g., resizing, face cropping, augmentations) prior to training.
- **`models/`**: Stores the output files of the trained models. Includes subdirectories for each model architecture (e.g., `cnn/`, `yolo_medium/`, `yolo_nano/`) containing the saved weights, ONNX exports, and evaluation reports (like `result.txt`).
- **Pipeline Sequence (`.py` scripts):**
  1. `0_split_images.py` & `0_preprocess_images.py`: Splits the raw dataset and applies preprocessing techniques.
  2. `1_train_*.py` (e.g., `1_train_cnn.py`, `1_train_yolo_medium.py`): Trains various neural network architectures (CNN, YOLO) on the datasets.
  3. `2_evaluate_model.py`: Evaluates model performance and generates confidence reports.
  4. `3_export_model.py`: Exports the best performing PyTorch/Keras models to the optimized ONNX format.
  5. `4_validate_onnx.py`: Validates the exported ONNX models to ensure accuracy is maintained.
---

## Key Features

The project functionality is divided into the following key modules:

### 1. User Module
- Handle authentication including account registration, authentication, and password recovery.
- Customer can view profile information and update profile details.
- **Actors:** Customer, Administrator

### 2. Product Module
- Allow customers to view product listings, search and filter products, and view detailed product information.
- Allow administrators to manage products including adding, updating, and deleting products.
- **Actors:** Customer, Administrator

### 3. Virtual Try-On Module
- Allow customers to virtually try on eyewear using webcam, mobile camera, or uploaded photos. Complete virtual try-on system including face detection and AR model rendering using MediaPipe and Three.js. 
- Allow administrators to manage AR model files and calibrate AR models for accurate fitting.
- **Actors:** Customer, Administrator

### 4. AI Chatbot Module
- Provide intelligent responses to customer inquiries, answer common questions using FAQs, and generate eyewear recommendations through integration with Google Gemini API.
- Allow administrators to manage FAQ knowledge content.
- **Actors:** Customer, Administrator, Google Gemini API

### 5. Booking Module
- Allow customers to reserve eyewear frames, view booking record, and cancel eligible bookings.
- Allow administrators to accept, reject, and update booking statuses.
- **Actors:** Customer, Administrator

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- **MySQL Database Server**: You can use a local development server like [XAMPP](https://www.apachefriends.org/index.html) or a cloud-hosted database.
- **External API Accounts** (required for environment variables):
  - [Google Gemini API](https://aistudio.google.com/) (for the AI chatbot)
  - [Cloudinary](https://cloudinary.com/) (for product image hosting)
  - [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) (for 3D AR model storage)

### 1. Backend Setup
1. **Database Creation:** If using XAMPP (or any local MySQL instance), open phpMyAdmin and create a new empty database (e.g., `og_vision_ar`). You **do not** need to manually create any tables; the backend ORM (Sequelize) will automatically generate them for you when the server starts.
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file in the `backend` directory based on your environment. For a local XAMPP setup, it would look like this:
   ```env
   # Email Configuration (Nodemailer)
   MAIL_USER=your_email@gmail.com
   MAIL_PASS=your_email_app_password
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   
   # Authentication
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRATION=86400
   
   # AI APIs
   GEMINI_API_KEY=your_gemini_api_key
   
   # Database Setup (Local XAMPP Example)
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=og_vision_ar
   
   # Cloudinary Credentials (for image uploads)
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   
   # Cloudflare R2 Credentials (for AR models)
   R2_ACCOUNT_ID=your_r2_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key
   R2_SECRET_ACCESS_KEY=your_r2_secret_key
   R2_PUBLIC_URL=your_r2_public_url
   R2_BUCKET_NAME=your_r2_bucket_name
   ```
5. Start the development server:
   ```bash
   npm start
   ```
   *(Note: On the first successful run, you will see "Synced db" in your console, confirming that your database tables have been created successfully.)*

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the `frontend` directory to link it with your backend API. For local development, it should look like this:
   ```env
   # Exposed to the browser: Used by client-side React components
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
   
   # Kept secure on the server: Used by Next.js Server Components (Server-Side Rendering)
   BACKEND_API_URL=http://localhost:8080
   ```
   *(Note: Next.js strictly requires variables starting with `NEXT_PUBLIC_` to be used in browser/client code. Variables without this prefix are kept secure on the server. Even though both point to the same backend, they serve different environments within Next.js.)*
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Face Shape Classifier Setup (Optional)
If you wish to retrain or modify the machine learning models:
1. Navigate to the classifier directory:
   ```bash
   cd face_shape_classifier
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv final_env
   # On Windows:
   final_env\Scripts\activate
   # On Mac/Linux:
   source final_env/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install tensorflow ultralytics opencv-python numpy matplotlib seaborn scikit-learn mediapipe Pillow onnx
   ```
4. **Download the Dataset:** Download the face shape dataset from Kaggle (see Acknowledgments) and extract it into the `face_shape_classifier/dataset/raw/` directory so that it contains the `train` and `test` folders.
5. Run the preprocessing and training scripts sequentially (`0_*.py` through `4_*.py`).

---

## Acknowledgments
- **Dataset:** The face image dataset used for training the face shape classifier is sourced from Kaggle: [Face Shape Dataset by Niten19](https://www.kaggle.com/datasets/niten19/face-shape-dataset).

## License
This project is for academic purposes.
