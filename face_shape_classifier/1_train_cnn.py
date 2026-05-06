import os
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True 

# config paths and params
DATA_DIR = "dataset/split/images"
MODEL_DIR = "models/cnn"
CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 100

def main():
    print("\n=========================================")
    print("Training CNN (MobileNetV2) on RAW images...")
    print(f"Dataset: {DATA_DIR}")
    print(f"Epochs: {EPOCHS} | Batch Size: {BATCH_SIZE} | Image Size: {IMG_SIZE}")
    print("=========================================\n")
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    train_dir = os.path.join(DATA_DIR, "train")
    val_dir = os.path.join(DATA_DIR, "val")
    if not os.path.exists(val_dir):
        val_dir = os.path.join(DATA_DIR, "valid") # fallback just in case

    if not os.path.exists(train_dir):
        print("Oops, image dataset not found. Check your paths!")
        return

    print("Setting up data generators and augmentations...")
    train_datagen = ImageDataGenerator(
        preprocessing_function=preprocess_input, 
        rotation_range=15,       # slight tilts
        width_shift_range=0.1,   # off-center faces
        height_shift_range=0.1,
        zoom_range=0.1,          # different face sizes
        horizontal_flip=True     # mirror flip
    )
    val_datagen = ImageDataGenerator(preprocessing_function=preprocess_input)
    
    train_gen = train_datagen.flow_from_directory(
        train_dir, target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE, class_mode='categorical', classes=CLASS_NAMES
    )
    val_gen = val_datagen.flow_from_directory(
        val_dir, target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE, class_mode='categorical', classes=CLASS_NAMES, shuffle=False
    )

    print("Building model architecture...")
    base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(IMG_SIZE, IMG_SIZE, 3))
    
    # unfreeze top 40 layers for fine-tuning
    base_model.trainable = True
    for layer in base_model.layers[:-40]:
        layer.trainable = False
        
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dropout(0.4)(x) 
    predictions = Dense(5, activation='softmax')(x)
    
    model = Model(inputs=base_model.input, outputs=predictions)
    
    # label smoothing to prevent overconfidence
    loss_fn = tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1)
    model.compile(optimizer=Adam(learning_rate=1e-4), loss=loss_fn, metrics=['accuracy'])

    callbacks = [
        EarlyStopping(monitor='val_loss', patience=8, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-6, verbose=1)
    ]

    print("Kicking off training now...")
    history = model.fit(train_gen, validation_data=val_gen, epochs=EPOCHS, callbacks=callbacks, verbose=1)
    
    model_path = os.path.join(MODEL_DIR, "cnn_model.keras")
    model.save(model_path)
    print(f"\nAwesome! Model saved to {model_path}")

    # plot learning curve
    print("Generating learning curve plot...")
    plt.figure(figsize=(12, 4))
    plt.subplot(1, 2, 1)
    plt.plot(history.history['accuracy'], label='Train Acc')
    plt.plot(history.history['val_accuracy'], label='Val Acc')
    plt.title('Accuracy')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Train Loss')
    plt.plot(history.history['val_loss'], label='Val Loss')
    plt.title('Loss')
    plt.legend()
    
    plot_path = os.path.join(MODEL_DIR, "learning_curve.png")
    plt.savefig(plot_path)
    print(f"Plot saved to {plot_path}")

if __name__ == "__main__":
    main()