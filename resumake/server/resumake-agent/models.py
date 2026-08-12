"""Shared request/response shapes for the /ollama endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Bullet(BaseModel):
    id: str
    text: str
    tags: list[str] = Field(default_factory=list)
    has_metric: bool = False


class ProjectLink(BaseModel):
    name: str
    href: str


class Section(BaseModel):
    id: str
    kind: Literal["job", "project"]
    label: str
    dates: str
    bullets: list[Bullet]
    location: str | None = None
    company: str | None = None
    role: str | None = None
    links: list[ProjectLink] | None = None


class AnalyzeRequest(BaseModel):
    sections: list[Section]
    jdText: str
    maxBullets: int = 4
    model: str = "llama3.2:3b"
    host: str | None = None


class ImproveRequest(BaseModel):
    bulletText: str
    tags: list[str] = Field(default_factory=list)
    jdText: str
    model: str = "llama3.2:3b"
    host: str | None = None


class ExtractRequest(BaseModel):
    rawText: str
    sourceLabel: str
    model: str = "llama3.2:3b"
    host: str | None = None
