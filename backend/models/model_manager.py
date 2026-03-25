import torch
import torch.nn as nn
from pathlib import Path
import os
from models.architecture.zero_dce import ZeroDCE

class ModelManager:
    def __init__(self):
        self.models = {}
        self.model_paths = {
            "lol_real": "trained_models_SMG_Low_Light_Enhancement/trained_models/LOL_real/model.pt"
        }
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")

    async def load_models(self):
        """Load all available models"""
        for model_id, model_path in self.model_paths.items():
            try:
                # Always instantiate the architecture first
                model = ZeroDCE()
                
                if os.path.exists(model_path):
                    # Load the state dict
                    state_dict = torch.load(model_path, map_location=self.device)
                    # Handle 'module.' prefix if saved with DataParallel
                    if isinstance(state_dict, dict):
                        if any(k.startswith('module.') for k in state_dict.keys()):
                            state_dict = {k[7:]: v for k, v in state_dict.items()}
                        try:
                            model.load_state_dict(state_dict)
                        except Exception as e:
                            print(f"Error loading state dict, structure mismatch? {e}")
                    else:
                        print("Warning: loaded object is not a state dict. Attempting to use directly.")
                        model = state_dict # Fallback
                else:
                    print(f"Warning: Model file not found at {model_path}. Using uninitialized model.")
                
                model.eval()
                model.to(self.device)
                self.models[model_id] = model
                print(f"Loaded {model_id} model successfully")
                
            except Exception as e:
                print(f"Error loading {model_id} model: {e}")

    def get_model(self, model_id):
        """Get a specific model by ID"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not loaded")
        return self.models[model_id]

    def is_model_loaded(self, model_id):
        """Check if a model is loaded"""
        return model_id in self.models

    def get_available_models(self):
        """Get list of available models"""
        return list(self.models.keys())
