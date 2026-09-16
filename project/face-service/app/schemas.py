from pydantic import BaseModel


class QualityResponse(BaseModel):
    is_valid: bool
    reason: str | None = None


class LivenessResponse(BaseModel):
    passed: bool
    confidence: float
    reason: str | None = None


class EmbeddingResponse(BaseModel):
    embedding_ref: str
    embedding_version: str


class CompareRequest(BaseModel):
    live_embedding_ref: str
    stored_embedding_ref: str


class CompareResponse(BaseModel):
    similarity: float


class ErrorResponse(BaseModel):
    error: str
    reason: str | None = None
