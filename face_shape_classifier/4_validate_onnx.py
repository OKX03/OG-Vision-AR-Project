import os
import cv2
import csv
import numpy as np
import onnxruntime as ort
from ultralytics import YOLO

PT_MODEL_PATH = "models/yolo_medium_preprocessed/model.pt"
ONNX_MODEL_PATH = "models/yolo_medium_preprocessed/model.onnx"


TEST_FOLDER_PATH = "dataset/preprocessed_split/test" 
REPORT_FILE_PATH = "parity_confidence_report.csv"

CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']

def preprocess_onnx(img_bgr):
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_rgb.shape[:2]
    
    scale = 224.0 / min(h, w)
    new_h = max(224, int(round(h * scale)))
    new_w = max(224, int(round(w * scale)))
    resized_img = cv2.resize(img_rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    top = (new_h - 224) // 2
    left = (new_w - 224) // 2
    crop_img = resized_img[top:top+224, left:left+224]

    input_tensor = crop_img.astype(np.float32) / 255.0
    input_tensor = np.transpose(input_tensor, (2, 0, 1))
    input_tensor = np.expand_dims(input_tensor, axis=0)
    return input_tensor

def main():
    print("=== STAGE 6: PyTorch vs ONNX Batch Parity Check (With Confidence Report) ===")
    
    if not os.path.exists(TEST_FOLDER_PATH):
        print(f"Error: Folder {TEST_FOLDER_PATH} does not exist!")
        return

    print(f"[*] Loading PT model from {PT_MODEL_PATH}...")
    pt_model = YOLO(PT_MODEL_PATH)
    
    print(f"[*] Loading ONNX model from {ONNX_MODEL_PATH}...")
    session = ort.InferenceSession(ONNX_MODEL_PATH, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name

    total_images = 0
    match_count = 0
    total_conf_diff = 0.0

    print(f"\n[*] Starting batch inference. Report will be saved to {REPORT_FILE_PATH}...")

    with open(REPORT_FILE_PATH, mode='w', newline='', encoding='utf-8') as csv_file:
        writer = csv.writer(csv_file)

        writer.writerow(["Image Name", "True Class", "PT Pred Class", "PT Conf (%)", "ONNX Pred Class", "ONNX Conf (%)", "Class Match?", "Conf Difference (%)"])

        for root, dirs, files in os.walk(TEST_FOLDER_PATH):
            true_class = os.path.basename(root)
            
            for file in files:
                if not file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    continue
                    
                img_path = os.path.join(root, file)
                img_bgr = cv2.imread(img_path)
                if img_bgr is None:
                    continue

                total_images += 1

                pt_results = pt_model(img_path, verbose=False)[0]
                pt_pred_idx = pt_results.probs.top1
                pt_pred_class = pt_results.names[pt_pred_idx]
                pt_conf = pt_results.probs.top1conf.item() * 100
 
                input_tensor = preprocess_onnx(img_bgr)
                onnx_outputs = session.run(None, {input_name: input_tensor})
                probs = onnx_outputs[0][0]
                onnx_pred_idx = np.argmax(probs)
                onnx_pred_class = CLASS_NAMES[onnx_pred_idx]
                onnx_conf = probs[onnx_pred_idx] * 100 

                is_match = (pt_pred_class == onnx_pred_class)
                if is_match:
                    match_count += 1

                conf_diff = abs(pt_conf - onnx_conf)
                total_conf_diff += conf_diff

                writer.writerow([
                    file, 
                    true_class, 
                    pt_pred_class, 
                    f"{pt_conf:.4f}", 
                    onnx_pred_class, 
                    f"{onnx_conf:.4f}", 
                    "YES" if is_match else "NO", 
                    f"{conf_diff:.4f}"
                ])

                if total_images % 100 == 0:
                    print(f"Processed {total_images} images...")

    if total_images == 0:
        print("No images found in the specified directory.")
        return

    match_rate = (match_count / total_images) * 100
    avg_conf_diff = total_conf_diff / total_images

    print("\n" + "="*55)
    print("MODEL PARITY REPORT SUMMARY")
    print("="*55)
    print(f"Total Images Tested     : {total_images}")
    print(f"Total Matches           : {match_count}")
    print(f"Parity Match Rate       : {match_rate:.2f}%")
    print(f"Average Confidence Diff : {avg_conf_diff:.4f}%")
    print("="*55)
    print(f"Detailed report successfully saved to: {REPORT_FILE_PATH}")

if __name__ == "__main__":
    main()