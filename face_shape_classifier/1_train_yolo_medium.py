import os
import shutil
from ultralytics import YOLO

# config paths and params
DATA_DIR = "dataset/split/images"
MODEL_DIR = "models/yolo_medium"
MAX_EPOCHS = 100
IMG_SIZE = 224
BATCH_SIZE = 32

def main():
    print("\n=========================================")
    print("Training YOLOv8 MEDIUM on RAW images...")
    print(f"Dataset: {DATA_DIR}")
    print(f"Max Epochs: {MAX_EPOCHS} (Early Stopping: 25) | Batch Size: {BATCH_SIZE} | Image Size: {IMG_SIZE}")
    print("=========================================\n")
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    dataset_abs_dir = os.path.abspath(DATA_DIR)
    
    if not os.path.exists(dataset_abs_dir):
        print("Oops, image dataset not found. Split the images first!")
        return

    valid_dir = os.path.join(dataset_abs_dir, "valid")
    val_dir = os.path.join(dataset_abs_dir, "val")
    if os.path.exists(valid_dir) and not os.path.exists(val_dir):
        print("Renaming 'valid' to 'val' for YOLO...")
        os.rename(valid_dir, val_dir)

    print("Loading YOLOv8m model...")
    model = YOLO('yolov8m-cls.pt')

    print("Kicking off training now...")
    model.train(
        data=dataset_abs_dir, 
        epochs=MAX_EPOCHS,
        patience=25,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        workers=4,
        project=MODEL_DIR,
        name="run"
    )

    best_pt = os.path.join(MODEL_DIR, 'run', 'weights', 'best.pt')
    results_png = os.path.join(MODEL_DIR, 'run', 'results.png')
    
    if os.path.exists(best_pt):
        shutil.copy(best_pt, os.path.join(MODEL_DIR, 'best_yolo_medium.pt'))
        print(f"\nAwesome! Best weights saved to {MODEL_DIR}/best_yolo_medium.pt")
        
    if os.path.exists(results_png):
        shutil.copy(results_png, os.path.join(MODEL_DIR, 'learning_curve.png'))
        print(f"Learning curve plot saved to {MODEL_DIR}/learning_curve.png")

if __name__ == "__main__":
    main()