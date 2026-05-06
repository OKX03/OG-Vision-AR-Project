import os
import json
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
from tensorflow.keras.layers import Input, Dense, Dropout
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import StandardScaler

# config paths and params
DATA_DIR = "dataset/split/landmarks"
MODEL_DIR = "models/mlp"
CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASS_NAMES)}
EPOCHS = 100
BATCH_SIZE = 32

def extract_features(lm):
    """extract 7 core geometric ratio features from landmarks"""
    def dist(a, b): return np.linalg.norm(a - b)
    try:
        face_w = dist(lm[234], lm[454])
        face_h = dist(lm[10], lm[152])
        cheek_w = dist(lm[93], lm[323])
        jaw_w = dist(lm[172], lm[397])
        forehead_w = dist(lm[127], lm[356])

        # avoid division by zero
        eps = 1e-6
        return np.array([
            face_h / (face_w + eps), 
            cheek_w / (face_w + eps), 
            jaw_w / (face_w + eps), 
            forehead_w / (face_w + eps),
            cheek_w / (jaw_w + eps), 
            forehead_w / (jaw_w + eps), 
            cheek_w / (forehead_w + eps)
        ], dtype=np.float32)
    except: 
        return None

def load_data(split):
    """load npy files and convert to features/labels"""
    X, y = [], []
    split_dir = os.path.join(DATA_DIR, split)
    if not os.path.exists(split_dir):
        return None, None
        
    for label in CLASS_NAMES:
        folder = os.path.join(split_dir, label)
        if not os.path.exists(folder): continue
        for file in os.listdir(folder):
            if not file.endswith(".npy"): continue
            lm = np.load(os.path.join(folder, file))
            feat = extract_features(lm)
            if feat is not None:
                X.append(feat)
                y.append(CLASS_TO_IDX[label])
                
    if len(y) == 0: return None, None
    y_cat = tf.keras.utils.to_categorical(np.array(y), num_classes=len(CLASS_NAMES))
    return np.array(X), y_cat

def main():
    print("\n=========================================")
    print("Training MLP on Facial Landmarks...")
    print(f"Dataset: {DATA_DIR}")
    print(f"Epochs: {EPOCHS} | Batch Size: {BATCH_SIZE}")
    print("=========================================\n")
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    print("Loading landmark data... (This might take a few seconds)")
    X_train, y_train = load_data("train")
    X_val, y_val = load_data("val")
    
    if X_train is None or len(X_train) == 0:
        print("Oops, landmark data not found. Extract them first!")
        return

    print(f"Loaded {len(X_train)} train samples and {len(X_val)} validation samples.")

    # standardize features (super important for MLP)
    print("Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    
    # save scaler params for future predictions
    scaler_params = {'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist()}
    with open(os.path.join(MODEL_DIR, 'mlp_scaler.json'), 'w') as f:
        json.dump(scaler_params, f)

    print("Building MLP model...")
    model = Sequential([
        Input(shape=(7,)),
        Dense(64, activation='relu'),
        Dropout(0.2),
        Dense(32, activation='relu'),
        Dense(len(CLASS_NAMES), activation='softmax')
    ])

    model.compile(optimizer=Adam(learning_rate=0.001), loss='categorical_crossentropy', metrics=['accuracy'])

    print("Kicking off training now...")
    history = model.fit(
        X_train_scaled, y_train, 
        validation_data=(X_val_scaled, y_val),
        epochs=EPOCHS, batch_size=BATCH_SIZE,
        callbacks=[EarlyStopping(monitor='val_accuracy', patience=15, restore_best_weights=True)],
        verbose=1
    )

    model_path = os.path.join(MODEL_DIR, "mlp_model.keras")
    model.save(model_path)
    print(f"\nAwesome! Model saved to {model_path}")

    print("Generating learning curve plot...")
    plt.figure(figsize=(12, 4))
    plt.subplot(1, 2, 1)
    plt.plot(history.history['accuracy'], label='Train Acc')
    plt.plot(history.history['val_accuracy'], label='Val Acc')
    plt.title('MLP Accuracy')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Train Loss')
    plt.plot(history.history['val_loss'], label='Val Loss')
    plt.title('MLP Loss')
    plt.legend()
    
    plot_path = os.path.join(MODEL_DIR, "learning_curve.png")
    plt.savefig(plot_path)
    print(f"Plot saved to {plot_path}")

if __name__ == "__main__":
    main()