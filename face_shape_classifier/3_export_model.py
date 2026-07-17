from ultralytics import YOLO
import os

def main():
    print("EXPORTING YOLO TO ONNX")

    model_path = "models/yolo_medium/model.pt" 
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return

    model = YOLO(model_path)

    print("Exporting model to ONNX...")

    model.export(
        format="onnx",
        imgsz=224,
        half=False,
        simplify=False
    )
    
    print("\nExport complete successfully!")
    print(f"ONNX model saved as: {model_path.replace('.pt', '.onnx')}")

if __name__ == "__main__":
    main()