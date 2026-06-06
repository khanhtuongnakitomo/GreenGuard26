from ultralytics.data.utils import check_det_dataset
import os

def main():
    yaml_path = '../configs/data.yaml'
    
    # Try root directory if run from root
    if not os.path.exists(yaml_path) and os.path.exists('configs/data.yaml'):
        yaml_path = 'configs/data.yaml'
        
    if not os.path.exists(yaml_path):
        print(f"Error: Could not find {yaml_path}")
        print("Please make sure you are running this from the root or scripts directory.")
        return
        
    print(f"Checking dataset configuration using {yaml_path}...")
    try:
        results = check_det_dataset(yaml_path)
        print("\nDataset check complete.")
        print("Please verify the following manually:")
        print("- Train/Val/Test ratio is appropriate (e.g., 70/20/10)")
        print("- No class imbalance (no class should take > 60% of data)")
        print("- All images have corresponding labels")
        print("- Images have adequate resolution (>= 416x416)")
    except Exception as e:
        print(f"\nAn error occurred during dataset check: {e}")
        print("Have you downloaded/prepared the dataset at the path specified in data.yaml?")

if __name__ == '__main__':
    main()
