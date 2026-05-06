import os
import shutil
import random

# config paths
RAW_TRAIN_DIR = "dataset/raw/train"
RAW_TEST_DIR = "dataset/raw/test"
DEST_DIR = "dataset/split/images"
CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square']
VAL_RATIO = 0.2

def copy_files(source_dir, dest_split_dir, files_dict=None):
    count = 0
    for raw_class in os.listdir(source_dir):
        class_path = os.path.join(source_dir, raw_class)
        if not os.path.isdir(class_path): 
            continue
        
        folder_name = raw_class.lower()
                
        if folder_name not in CLASS_NAMES: 
            continue
        
        save_dir = os.path.join(DEST_DIR, dest_split_dir, folder_name)
        os.makedirs(save_dir, exist_ok=True)
        
        if files_dict is not None:
            files_to_copy = files_dict[folder_name]
        else:
            files_to_copy = [f for f in os.listdir(class_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
            
        for f in files_to_copy:
            src = os.path.join(class_path, f)
            dst = os.path.join(save_dir, f)
            shutil.copy2(src, dst)
            count += 1
    return count

def main():
    print("Splitting dataset now...")
    random.seed(42)
    
    if os.path.exists(DEST_DIR):
        print(f"Cleaning up old {DEST_DIR} folder...")
        shutil.rmtree(DEST_DIR)
        
    files_train = {c: [] for c in CLASS_NAMES}
    files_val = {c: [] for c in CLASS_NAMES}
    
    # process train and val
    if os.path.exists(RAW_TRAIN_DIR):
        for raw_class in os.listdir(RAW_TRAIN_DIR):
            class_path = os.path.join(RAW_TRAIN_DIR, raw_class)
            if not os.path.isdir(class_path): continue
            
            folder_name = raw_class.lower()
            for c in CLASS_NAMES:
                if c in folder_name: folder_name = c
            if folder_name not in CLASS_NAMES: continue
            
            all_files = [f for f in os.listdir(class_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
            random.shuffle(all_files)
            val_count = int(len(all_files) * VAL_RATIO)
            
            files_val[folder_name] = all_files[:val_count]
            files_train[folder_name] = all_files[val_count:]
            
        print(f"Copied {copy_files(RAW_TRAIN_DIR, 'train', files_train)} training images.")
        print(f"Copied {copy_files(RAW_TRAIN_DIR, 'val', files_val)} validation images.")
    else:
        print(f"{RAW_TRAIN_DIR} not found.")

    # process test
    if os.path.exists(RAW_TEST_DIR):
        print(f"Copied {copy_files(RAW_TEST_DIR, 'test')} testing images.")
    else:
        print(f"{RAW_TEST_DIR} not found.")
        
    print("Done splitting images!")

if __name__ == "__main__":
    main()