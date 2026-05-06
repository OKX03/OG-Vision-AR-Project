import os
import cv2
import numpy as np
import onnxruntime as ort
import mediapipe as mp

ONNX_MODEL_PATH = "models/yolo_medium_preprocessed/model.onnx"
TEST_ROOT_DIR = "dataset/split/test" 
CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']
IMG_SIZE = 224

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1)

def simulate_frontend_preprocess(image_bgr):
    h, w, _ = image_bgr.shape
    rgb_img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_img)

    if not results.multi_face_landmarks:
        return None

    landmarks = results.multi_face_landmarks[0].landmark

    left_eye = landmarks[33]
    right_eye = landmarks[263]
    lx, ly = left_eye.x * w, left_eye.y * h
    rx, ry = right_eye.x * w, right_eye.y * h
    
    angle = np.degrees(np.arctan2(ry - ly, rx - lx))
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    aligned_img = cv2.warpAffine(image_bgr, M, (w, h))

    aligned_rgb = cv2.cvtColor(aligned_img, cv2.COLOR_BGR2RGB)
    res_aligned = face_mesh.process(aligned_rgb)
    if not res_aligned.multi_face_landmarks:
        return None
    
    lms_aligned = res_aligned.multi_face_landmarks[0].landmark
    xs = [lm.x for lm in lms_aligned]
    ys = [lm.y for lm in lms_aligned]
    
    x_min, x_max = int(min(xs) * w), int(max(xs) * w)
    y_min, y_max = int(min(ys) * h), int(max(ys) * h)
    
    pad_x = int((x_max - x_min) * 0.2)
    pad_y = int((y_max - y_min) * 0.3)
    
    x1 = max(0, x_min - pad_x)
    x2 = min(w, x_max + pad_x)
    y1 = max(0, y_min - pad_y)
    y2 = min(h, y_max + pad_y)
    
    face_crop = aligned_img[y1:y2, x1:x2]

    face_resized = cv2.resize(face_crop, (IMG_SIZE, IMG_SIZE))
    face_rgb = cv2.cvtColor(face_resized, cv2.COLOR_BGR2RGB)
    
    input_data = face_rgb.astype(np.float32) / 255.0
    input_data = np.transpose(input_data, (2, 0, 1))
    input_data = np.expand_dims(input_data, axis=0) 
    
    return input_data

def main():
    print(f"[*] Loading ONNX Model: {ONNX_MODEL_PATH}")
    session = ort.InferenceSession(ONNX_MODEL_PATH, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name

    print(f"[*] Scanning test root directory: {TEST_ROOT_DIR}\n")

    stats = {
        'total_images': 0,
        'mp_failed': 0,
        'classes': {c: {'correct': 0, 'wrong': 0, 'total': 0} for c in CLASS_NAMES}
    }

    for folder_name in os.listdir(TEST_ROOT_DIR):
        folder_path = os.path.join(TEST_ROOT_DIR, folder_name)
        if not os.path.isdir(folder_path):
            continue
            
        true_class = folder_name.lower().replace(" face", "").strip()

        if true_class not in CLASS_NAMES:
            matched = False
            for c in CLASS_NAMES:
                if c in true_class:
                    true_class = c
                    matched = True
                    break
            if not matched:
                print(f"[Warning] Unknown class folder: {folder_name}")
                continue

        print(f"Processing Category: [{true_class.upper()}]...")

        for img_name in os.listdir(folder_path):
            if not img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                continue
                
            img_path = os.path.join(folder_path, img_name)
            raw_img = cv2.imread(img_path)
            if raw_img is None:
                continue

            stats['total_images'] += 1
            stats['classes'][true_class]['total'] += 1

            blob = simulate_frontend_preprocess(raw_img)
            
            if blob is None:
                stats['mp_failed'] += 1
                stats['classes'][true_class]['wrong'] += 1 
                continue

            outputs = session.run(None, {input_name: blob})
            probs = outputs[0][0]
            
            pred_idx = np.argmax(probs)
            pred_class = CLASS_NAMES[pred_idx]
            
            if pred_class == true_class:
                stats['classes'][true_class]['correct'] += 1
            else:
                stats['classes'][true_class]['wrong'] += 1

    print("\n" + "="*50)
    print("      FRONTEND PIPELINE SIMULATION REPORT      ")
    print("="*50)
    
    total_correct = sum(d['correct'] for d in stats['classes'].values())
    total_valid_test = stats['total_images']
    
    if total_valid_test == 0:
        print("No images processed.")
        return

    overall_acc = (total_correct / total_valid_test) * 100
    
    print(f"Total Images Tested : {total_valid_test}")
    print(f"MediaPipe Fails     : {stats['mp_failed']} (Considered as Wrong)")
    print(f"Overall Accuracy    : {overall_acc:.2f}%\n")
    
    print(f"{'CLASS':<10} | {'TOTAL':<6} | {'CORRECT':<8} | {'WRONG':<6} | {'ACCURACY'}")
    print("-" * 50)
    
    for c_name in CLASS_NAMES:
        c_stats = stats['classes'][c_name]
        c_total = c_stats['total']
        c_corr = c_stats['correct']
        c_wrng = c_stats['wrong']
        
        if c_total > 0:
            c_acc = (c_corr / c_total) * 100
            print(f"{c_name.upper():<10} | {c_total:<6} | {c_corr:<8} | {c_wrng:<6} | {c_acc:.2f}%")
        else:
            print(f"{c_name.upper():<10} | {0:<6} | {0:<8} | {0:<6} | N/A")
            
    print("="*50)

if __name__ == "__main__":
    face_mesh.close()
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1)
    main()