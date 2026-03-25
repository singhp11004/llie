import re

with open('project_status/01_current_state.md', 'r') as f:
    content = f.read()

# Update Status
content = content.replace(
    '**Project Status:** ⚠️ Partially Functional — Core AI Feature Non-Operational',
    '**Project Status:** ✅ Functional — Core AI Feature Operational'
)

# Update 3.1
content = re.sub(
    r'### 3\.1 Core Issue — AI Model Is Never Actually Used.*?### 3\.2',
    '### 3.1 ✅ Core Issue Resolved — Real AI Model Integrated\n\nThe placeholder `simple_enhancement` method was removed. The application now correctly initializes the `ZeroDCE` PyTorch module and passes the input tensor through the actual neural network to perform enhancement. The output is correctly rescaled to `[0, 1]` for the PIL image.\n\n### 3.2',
    content, flags=re.DOTALL
)

# Update 3.2
content = re.sub(
    r'### 3\.2 Model File Likely Missing.*?### 3\.3',
    '### 3.2 ✅ Model File Now Present\n\nThe expected pre-trained Zero-DCE model weights (`Epoch99.pth`) have been downloaded and placed at `backend/trained_models_SMG_Low_Light_Enhancement/trained_models/LOL_real/model.pt`. The model loads successfully on backend startup.\n\n### 3.3',
    content, flags=re.DOTALL
)

# Update Matrix
content = content.replace(
    '| 1 | AI model never called — placeholder used | 🔴 Critical | Core feature completely broken |',
    '| 1 | ~~AI model never called — placeholder used~~ | ✅ Resolved | Model architecture implemented |'
)
content = content.replace(
    '| 2 | Model architecture not defined — state dict unusable | 🔴 Critical | Even with model file, inference fails |',
    '| 2 | ~~Model architecture not defined — state dict unusable~~ | ✅ Resolved | ZeroDCE architecture defined |'
)
content = content.replace(
    '| 6 | Model file missing from repository | 🟠 High | Backend always falls back to placeholder |',
    '| 6 | ~~Model file missing from repository~~ | ✅ Resolved | Weights downloaded and integrated |'
)

# Add note to section 2 (Working)
content = content.replace(
    '| User login / logout | ✅ Working | Token-based session, persists in `localStorage` |',
    '| User login / logout | ✅ Working | Token-based session, persists in `localStorage` |\n| Guest Upload Mode | ✅ Working | App can be used without registering |'
)

# Fix section 4 - actual structure
content = content.replace(
    '├── image_processor.py      # ⚠️ PLACEHOLDER — no real model inference',
    '├── image_processor.py      # ✅ Real Zero-DCE network inference'
).replace(
    '└── model_manager.py        # ⚠️ BROKEN — doesn\'t rebuild model from state dict',
    '└── model_manager.py        # ✅ Successfully loads state dict into model'
).replace(
 auth_manager.py         # JSON file-based auth',    '
    '├── architecture/\n│       │   └── zero_dce.py         # Added Zero-DCE PyTorch architecture\n│       ├── auth_manager.py         # JSON file-based auth'
)

with open('project_status/01_current_state.md', 'w') as f:
    f.write(content)

with open('project_status/03_upgrade_plans.md', 'r') as f:
    content2 = f.read()

content2 = content2.replace(
    '## Upgrade 2: Real Neural Network Integration',
    '## ✅ Upgrade 2: Real Neural Network Integration [COMPLETED]'
)

with open('project_status/03_upgrade_plans.md', 'w') as f:
    f.write(content2)

print("Documentation updated successfully.")
