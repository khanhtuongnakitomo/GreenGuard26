from ultralytics.data.utils import check_det_dataset
import os

def main():
    yaml_path = '../data.yaml'
    
    # Try current directory if run from detection folder
    if not os.path.exists(yaml_path) and os.path.exists('data.yaml'):
        yaml_path = 'data.yaml'
        
    if not os.path.exists(yaml_path):
        print(f"Error: Could not find {yaml_path}")
        print("Please make sure you are running this from the detection or scripts directory.")
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
