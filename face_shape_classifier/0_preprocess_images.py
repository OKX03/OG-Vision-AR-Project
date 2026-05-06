import os
import cv2
import numpy as np
import mediapipe as mp

# config paths
IMG_DIR = "dataset/split/images"
SAVE_DIR = "dataset/preprocessed_split/images"
CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']
IMG_SIZE = 224

mp_face_mesh = mp.solutions.face_mesh

# helper functions
def align_face(image, landmarks, w, h):
    left_eye = landmarks[33]
    right_eye = landmarks[263]

    x1, y1 = int(left_eye.x * w), int(left_eye.y * h)
    x2, y2 = int(right_eye.x * w), int(right_eye.y * h)

    angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
    M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
    return cv2.warpAffine(image, M, (w, h))

def crop_face(image, landmarks, w, h):
    xs = [lm.x for lm in landmarks]
    ys = [lm.y for lm in landmarks]

    x_min, x_max = int(min(xs)*w), int(max(xs)*w)
    y_min, y_max = int(min(ys)*h), int(max(ys)*h)

    # padding ratio matching our training settings
    pad_x = int((x_max - x_min) * 0.2)
    pad_y = int((y_max - y_min) * 0.3)

    x1 = max(0, x_min - pad_x)
    x2 = min(w, x_max + pad_x)
    y1 = max(0, y_min - pad_y)
    y2 = min(h, y_max + pad_y)

    crop = image[y1:y2, x1:x2]
    return crop

def main():
    print("Preprocessing images (Aligning & Cropping)...")
    
    if not os.path.exists(IMG_DIR):
        print(f"Cannot find {IMG_DIR}. Please run the split script first.")
        return

    success = 0
    failed = 0

    with mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1) as face_mesh:
        for split in ['train', 'val', 'test']:
            for class_name in CLASS_NAMES:
                class_img_dir = os.path.join(IMG_DIR, split, class_name)
                save_img_dir = os.path.join(SAVE_DIR, split, class_name)
                
                if not os.path.exists(class_img_dir): 
                    continue
                    
                os.makedirs(save_img_dir, exist_ok=True)
                
                for img_name in os.listdir(class_img_dir):
                    if not img_name.lower().endswith(('.png', '.jpg', '.jpeg')): 
                        continue
                        
                    img_path = os.path.join(class_img_dir, img_name)
                    save_path = os.path.join(save_img_dir, img_name)
                    
                    # skip if already preprocessed
                    if os.path.exists(save_path):
                        success += 1
                        continue

                    image = cv2.imread(img_path)
                    if image is None: 
                        failed += 1
                        continue

                    h, w, _ = image.shape

                    #get landmarks for alignment
                    results = face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                    if not results.multi_face_landmarks:
                        failed += 1
                        continue

                    landmarks = results.multi_face_landmarks[0].landmark
                    aligned = align_face(image, landmarks, w, h)

                    #get landmarks again on the aligned image for cropping
                    h2, w2, _ = aligned.shape
                    results2 = face_mesh.process(cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB))
                    if not results2.multi_face_landmarks:
                        failed += 1
                        continue

                    landmarks2 = results2.multi_face_landmarks[0].landmark
                    crop = crop_face(aligned, landmarks2, w2, h2)

                    if crop.size == 0:
                        failed += 1
                        continue

                    #resize and save
                    crop_resized = cv2.resize(crop, (IMG_SIZE, IMG_SIZE))
                    cv2.imwrite(save_path, crop_resized)
                    success += 1

    print(f"Preprocess done! Successfully saved: {success}, Failed/Skipped: {failed}")

if __name__ == "__main__":
    main()