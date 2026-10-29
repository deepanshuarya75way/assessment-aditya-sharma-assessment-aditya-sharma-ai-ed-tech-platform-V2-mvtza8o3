from pydantic import BaseModel, Field, model_validator,EmailStr
from typing import Optional

class UserRegister(BaseModel):
    first_name: str = ""
    last_name: str = ""
    email: str = Field(...)
    password: str = Field(..., min_length=6)

    @model_validator(mode='after')  # this creates a function which will be executed after pydantic validation
    def set_default_name(self):
        email_name = self.email.split("@")[0]
        self.first_name = email_name
        return self

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str = Field(...)
    password: str = Field(...)

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    first_name: str
    last_name: str = None
    id: int
    email: str 


class TokenData(BaseModel):
    id: Optional[int] = None
    first_name: Optional[str] = None

class ChatRequest(BaseModel):
    user_query: str
    use_strictly_retriever: bool
    docs_available: bool
    session_id: str | None = None


class UserData(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None

class PassWord(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class UserProfileOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True
