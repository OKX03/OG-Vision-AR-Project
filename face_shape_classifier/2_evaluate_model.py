import os
import json
import cv2
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from ultralytics import YOLO
import tensorflow as tf
from PIL import ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True 

TEST_IMG_DIR = "dataset/split/test"
TEST_IMG_DIR_PREPROCESSED = "dataset/preprocessed_split/test"

MODEL_DIR = "models"
CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']

def plot_confusion_matrix(y_true, y_pred, model_name):
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES)
    plt.title(f'Confusion Matrix: {model_name}')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    
    save_path = os.path.join(MODEL_DIR, f"cm_{model_name.replace(' ', '_').lower()}.png")
    plt.savefig(save_path)
    plt.close()
    print(f"[*] Saved Confusion Matrix plot to {save_path}")

def print_metrics(model_name, y_true, y_pred):
    print(f"\n{'='*20} Evaluation: {model_name} {'='*20}")
    acc = accuracy_score(y_true, y_pred)
    print(f"Overall Accuracy: {acc * 100:.2f}%\n")
    print("Classification Report:")
    print(classification_report(y_true, y_pred, target_names=CLASS_NAMES, zero_division=0))
    plot_confusion_matrix(y_true, y_pred, model_name)

def eval_yolo():
    print("\nEvaluating YOLOv8...")
    model_path = os.path.join(MODEL_DIR, "yolo_nano/model.pt")
    if not os.path.exists(model_path): 
        print("YOLO model not found.")
        return
        
    model = YOLO(model_path)
    y_true, y_pred = [], []
    
    for i, class_name in enumerate(CLASS_NAMES):
        class_dir = os.path.join(TEST_IMG_DIR, class_name)
        if not os.path.exists(class_dir): continue
        for img in os.listdir(class_dir):
            if not img.lower().endswith(('.png', '.jpg', '.jpeg')): continue

            res = model(os.path.join(class_dir, img), verbose=False)[0]
            pred_class = res.names[res.probs.top1].lower()
            pred_idx = CLASS_NAMES.index(pred_class) if pred_class in CLASS_NAMES else -1
            
            y_true.append(i)
            y_pred.append(pred_idx)
            
    print_metrics("YOLOv8", y_true, y_pred)

def eval_yolo_medium():
    print("\nEvaluating YOLOv8 Medium...")
    model_path = os.path.join(MODEL_DIR, "yolo_medium/model.pt")
    if not os.path.exists(model_path): 
        print("YOLO model not found.")
        return
        
    model = YOLO(model_path)
    y_true, y_pred = [], []
    
    for i, class_name in enumerate(CLASS_NAMES):
        class_dir = os.path.join(TEST_IMG_DIR, class_name)
        if not os.path.exists(class_dir): continue
        for img in os.listdir(class_dir):
            if not img.lower().endswith(('.png', '.jpg', '.jpeg')): continue

            res = model(os.path.join(class_dir, img), verbose=False)[0]
            pred_class = res.names[res.probs.top1].lower()
            pred_idx = CLASS_NAMES.index(pred_class) if pred_class in CLASS_NAMES else -1
            
            y_true.append(i)
            y_pred.append(pred_idx)
            
    print_metrics("YOLOv8 Medium", y_true, y_pred)

def eval_yolo_medium_preprocessed():
    print("\nEvaluating YOLOv8 Medium Preprocessed...")
    model_path = os.path.join(MODEL_DIR, "yolo_medium_preprocessed/model.pt")
    if not os.path.exists(model_path): 
        print("YOLO model not found.")
        return
        
    model = YOLO(model_path)
    y_true, y_pred = [], []
    
    for i, class_name in enumerate(CLASS_NAMES):
        class_dir = os.path.join(TEST_IMG_DIR_PREPROCESSED, class_name)
        if not os.path.exists(class_dir): continue
        for img in os.listdir(class_dir):
            if not img.lower().endswith(('.png', '.jpg', '.jpeg')): continue

            res = model(os.path.join(class_dir, img), verbose=False)[0]
            pred_class = res.names[res.probs.top1].lower()
            pred_idx = CLASS_NAMES.index(pred_class) if pred_class in CLASS_NAMES else -1
            
            y_true.append(i)
            y_pred.append(pred_idx)
            
    print_metrics("YOLOv8 Medium Preprocessed", y_true, y_pred)


def eval_cnn():
    print("\nEvaluating MobileNetV2 (CNN)...")
    model_path = os.path.join(MODEL_DIR, "cnn/model.keras")
    if not os.path.exists(model_path): 
        print("CNN model not found.")
        return
        
    model = tf.keras.models.load_model(model_path)
    y_true, y_pred = [], []
    
    for i, class_name in enumerate(CLASS_NAMES):
        class_dir = os.path.join(TEST_IMG_DIR, class_name)
        if not os.path.exists(class_dir): continue
        for img_name in os.listdir(class_dir):
            if not img_name.lower().endswith(('.png', '.jpg', '.jpeg')): continue
            
            try:
                img_path = os.path.join(class_dir, img_name)
                img = cv2.imread(img_path)
                if img is None: continue
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                img = cv2.resize(img, (224, 224)) / 255.0
                
                pred = model.predict(np.expand_dims(img, axis=0), verbose=0)
                y_true.append(i)
                y_pred.append(np.argmax(pred))
            except Exception:
                continue
                
    print_metrics("CNN MobileNetV2", y_true, y_pred)


def eval_cnn_preprocessed():
    print("\nEvaluating MobileNetV2 (CNN) (Preprocessed)...")
    model_path = os.path.join(MODEL_DIR, "cnn_preprocessed/model.keras")
    if not os.path.exists(model_path): 
        print("CNN model not found.")
        return
        
    model = tf.keras.models.load_model(model_path)
    y_true, y_pred = [], []
    
    for i, class_name in enumerate(CLASS_NAMES):
        class_dir = os.path.join(TEST_IMG_DIR_PREPROCESSED, class_name)
        if not os.path.exists(class_dir): continue
        for img_name in os.listdir(class_dir):
            if not img_name.lower().endswith(('.png', '.jpg', '.jpeg')): continue
            
            try:
                img_path = os.path.join(class_dir, img_name)
                img = cv2.imread(img_path)
                if img is None: continue
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                img = cv2.resize(img, (224, 224)) / 255.0
                
                pred = model.predict(np.expand_dims(img, axis=0), verbose=0)
                y_true.append(i)
                y_pred.append(np.argmax(pred))
            except Exception:
                continue
                
    print_metrics("CNN MobileNetV2 (Preprocessed)", y_true, y_pred)


if __name__ == "__main__":
    print("EVALUATING MODELS ON TEST SET")
    eval_cnn()
    eval_cnn_preprocessed()
    eval_yolo()
    eval_yolo_medium()
    eval_yolo_medium_preprocessed()
    
