import os
import csv
import numpy as np
import onnxruntime as ort
from ultralytics import YOLO
from PIL import Image
import torchvision.transforms as transforms

PT_MODEL_PATH = "models/yolo_medium_preprocessed/model.pt"
ONNX_MODEL_PATH = "models/yolo_medium_preprocessed/model.onnx"
TEST_FOLDER_PATH = "dataset/preprocessed_split/test" 
REPORT_FILE_PATH = "parity_confidence_report.csv"

CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']

yolo_transforms = transforms.Compose([
    transforms.Resize(224, interpolation=transforms.InterpolationMode.BILINEAR),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
])

def main():
    
    pt_model = YOLO(PT_MODEL_PATH)
    session = ort.InferenceSession(ONNX_MODEL_PATH, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name

    total_images = 0
    match_count = 0
    total_conf_diff = 0.0

    with open(REPORT_FILE_PATH, mode='w', newline='', encoding='utf-8') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["Image Name", "True Class", "PT Pred Class", "PT Conf (%)", "ONNX Pred Class", "ONNX Conf (%)", "Class Match?", "Conf Difference (%)"])

        for root, dirs, files in os.walk(TEST_FOLDER_PATH):
            true_class = os.path.basename(root)
            for file in files:
                if not file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    continue
                    
                img_path = os.path.join(root, file)
                total_images += 1

                pt_results = pt_model(img_path, verbose=False)[0]
                pt_pred_class = pt_results.names[pt_results.probs.top1]
                pt_conf = pt_results.probs.top1conf.item() * 100

                img_pil = Image.open(img_path).convert('RGB')
                input_tensor = yolo_transforms(img_pil) 
                input_numpy = input_tensor.unsqueeze(0).numpy()
                
                onnx_outputs = session.run(None, {input_name: input_numpy})
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
                    file, true_class, pt_pred_class, f"{pt_conf:.4f}", 
                    onnx_pred_class, f"{onnx_conf:.4f}", 
                    "YES" if is_match else "NO", f"{conf_diff:.4f}"
                ])

                if total_images % 100 == 0:
                    print(f"Processed {total_images} images...")

    print("\n" + "="*55)
    print("100% ALIGNED PARITY REPORT SUMMARY")
    print("="*55)
    print(f"Total Images Tested     : {total_images}")
    print(f"Parity Match Rate       : {(match_count / total_images) * 100:.2f}%")
    print(f"Average Confidence Diff : {total_conf_diff / total_images:.6f}%")
    print("="*55)

if __name__ == "__main__":
    main()