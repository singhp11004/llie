import json
import os
import fcntl
from datetime import datetime, timedelta
from pathlib import Path
from passlib.context import CryptContext
from jose import JWTError, jwt

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7

class AuthManager:
    def __init__(self):
        self.users_file = Path("data/users.json")
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Create data directory if it doesn't exist
        self.users_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize file if it doesn't exist
        self._initialize_files()

    def _initialize_files(self):
        if not self.users_file.exists():
            with open(self.users_file, 'w') as f:
                json.dump({}, f)

    def _load_users(self):
        try:
            with open(self.users_file, 'r') as f:
                fcntl.flock(f, fcntl.LOCK_SH)
                data = json.load(f)
                fcntl.flock(f, fcntl.LOCK_UN)
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save_users(self, users):
        with open(self.users_file, 'w') as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            json.dump(users, f, indent=2)
            fcntl.flock(f, fcntl.LOCK_UN)

    def _hash_password(self, password):
        return self.pwd_context.hash(password)

    def _verify_password(self, plain_password, hashed_password):
        try:
            return self.pwd_context.verify(plain_password, hashed_password)
        except ValueError:
            # Fallback to check SHA-256 for backward compatibility with existing users
            import hashlib
            return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

    def _create_jwt_token(self, user_data):
        expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
        payload = {
            "sub": user_data["email"],
            "user_id": user_data["id"],
            "exp": expire
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    def register_user(self, email, password, name):
        try:
            users = self._load_users()
            
            if email in users:
                return {"success": False, "error": "User already exists"}
            
            if len(password) < 6:
                return {"success": False, "error": "Password must be at least 6 characters"}
            
            if not email or '@' not in email:
                return {"success": False, "error": "Invalid email address"}
            
            user_id = str(len(users) + 1)
            hashed_password = self._hash_password(password)
            
            user_data = {
                "id": user_id,
                "email": email,
                "name": name,
                "password": hashed_password,
                "created_at": datetime.now().isoformat(),
                "last_login": None
            }
            
            users[email] = user_data
            self._save_users(users)
            
            user_response = {k: v for k, v in user_data.items() if k != 'password'}
            return {"success": True, "user": user_response}
            
        except Exception as e:
            return {"success": False, "error": f"Registration failed: {str(e)}"}

    def login_user(self, email, password):
        try:
            users = self._load_users()
            
            if email not in users:
                return {"success": False, "error": "Invalid email or password"}
            
            user = users[email]
            
            if not self._verify_password(password, user["password"]):
                return {"success": False, "error": "Invalid email or password"}
            
            token = self._create_jwt_token(user)
            
            user["last_login"] = datetime.now().isoformat()
            users[email] = user
            self._save_users(users)
            
            user_response = {k: v for k, v in user.items() if k != 'password'}
            
            return {
                "success": True, 
                "token": token, 
                "user": user_response
            }
            
        except Exception as e:
            return {"success": False, "error": f"Login failed: {str(e)}"}

    def verify_token(self, token):
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_email = payload.get("sub")
            
            if user_email is None:
                return None
                
            users = self._load_users()
            
            if user_email not in users:
                return None
            
            user = users[user_email]
            user_response = {k: v for k, v in user.items() if k != 'password'}
            
            return user_response
            
        except JWTError:
            return None
        except Exception as e:
            print(f"Token verification error: {e}")
            return None

    def logout_user(self, token):
        return {"success": True}

    def get_user_by_id(self, user_id):
        try:
            users = self._load_users()
            for user in users.values():
                if user["id"] == user_id:
                    user_response = {k: v for k, v in user.items() if k != 'password'}
                    return user_response
            return None
        except Exception as e:
            print(f"Get user error: {e}")
            return None
