import torch
import torchvision.transforms as transforms
from PIL import Image
import cv2
import numpy as np
from pathlib import Path
import asyncio

class ImageProcessor:
    def __init__(self, model_manager):
        self.model_manager = model_manager
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Define image preprocessing transforms for ZeroDCE [0, 1]
        self.transform = transforms.Compose([
            transforms.ToTensor(),
        ])
        
        # Define inverse transform for output
        self.inverse_transform = transforms.Compose([
            transforms.ToPILImage()
        ])

    async def enhance_image(self, input_path, output_path, model_id="lol_real"):
        """
        Enhance a low light image using the specified model
        """
        try:
            # Load and preprocess image
            image = self.load_and_preprocess_image(input_path)
            
            # Get the model
            model = self.model_manager.get_model(model_id)
            
            # Process the image
            enhanced_image = await self.process_with_model(image, model, model_id)
            
            # Save the enhanced image
            self.save_enhanced_image(enhanced_image, output_path)
            
        except Exception as e:
            raise Exception(f"Image processing failed: {str(e)}")

    def load_and_preprocess_image(self, image_path):
        """Load and preprocess the input image"""
        try:
            # Load image
            image = Image.open(image_path).convert('RGB')
            
            # Resize if too large (optional, for memory management)
            max_size = 1024
            if max(image.size) > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            return image
        except Exception as e:
            raise Exception(f"Failed to load image: {str(e)}")

    async def process_with_model(self, image, model, model_id):
        """
        Process image with the specified model
        Since we don't know the exact model architecture, we'll use a generic approach
        """
        try:
            # Convert to tensor and add batch dimension
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            # For now, we'll use a simple enhancement approach
            # In a real implementation, you would use the actual model
            enhanced_tensor = await self.apply_enhancement(input_tensor, model, model_id)
            
            # Convert back to PIL Image
            enhanced_image = self.inverse_transform(enhanced_tensor.squeeze(0).cpu())
            
            return enhanced_image
            
        except Exception as e:
            raise Exception(f"Model processing failed: {str(e)}")

    async def apply_enhancement(self, input_tensor, model, model_id):
        """
        Apply enhancement using the real Deep Neural Network model
        """
        try:
            with torch.no_grad():
                enhanced = model(input_tensor)
                return enhanced
        except Exception as e:
            # Fallback to simple enhancement if model fails (e.g. OOM)
            print(f"Model processing failed, using fallback: {e}")
            return self.simple_enhancement(input_tensor)

    def simple_enhancement(self, input_tensor):
        """
        Simple enhancement fallback using basic image processing
        """
        # Apply brightness and contrast enhancement
        enhanced = input_tensor.clone()
        
        # Brightness adjustment
        enhanced = enhanced * 1.5
        
        # Contrast adjustment
        enhanced = (enhanced - 0.5) * 1.2 + 0.5
        
        # Clamp values to valid range [0, 1] for ToPILImage
        enhanced = torch.clamp(enhanced, 0.0, 1.0)
        
        return enhanced

    def save_enhanced_image(self, enhanced_image, output_path):
        """Save the enhanced image"""
        try:
            # Ensure output directory exists
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Save the image
            enhanced_image.save(output_path, quality=95)
            
        except Exception as e:
            raise Exception(f"Failed to save enhanced image: {str(e)}")

    def cleanup_files(self, file_paths):
        """Clean up temporary files"""
        for path in file_paths:
            try:
                if Path(path).exists():
                    Path(path).unlink()
            except Exception as e:
                print(f"Failed to delete {path}: {e}")
