import os
from PIL import Image

def convert_logo_to_ico():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    logo_path = os.path.join(base_dir, "build", "logo.png")
    ico_path = os.path.join(base_dir, "build", "icon.ico")
    
    print(f"Opening logo file: {logo_path}")
    if not os.path.exists(logo_path):
        print(f"Error: {logo_path} not found!")
        return False
        
    try:
        # Open the image (Pillow will handle it even if it's JPEG named .png)
        img = Image.open(logo_path)
        print(f"Loaded image format: {img.format}, size: {img.size}, mode: {img.mode}")
        
        # Save as ICO with standard sizes
        print(f"Saving as ICO to: {ico_path}")
        img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        print("Successfully generated build/icon.ico!")
        return True
    except Exception as e:
        print(f"Error during conversion: {e}")
        return False

if __name__ == "__main__":
    convert_logo_to_ico()
