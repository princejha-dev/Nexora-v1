"""
Document parsing and text chunking for InvestiGraph AI.

Handles the conversion of raw uploaded files (PDF and TXT) into clean
text, and then splits that text into overlapping chunks suitable for
embedding and retrieval.

Why RecursiveCharacterTextSplitter?
  - It tries to split on natural boundaries (paragraphs, sentences, words)
    before falling back to character-level splits
  - This preserves semantic coherence within each chunk
  - The 800-char chunk size with 100-char overlap balances:
    * Small enough to fit in Groq's context window alongside prompts
    * Large enough to contain meaningful information
    * Overlap ensures no information is lost at chunk boundaries

Why PyMuPDF (fitz) for PDFs?
  - Fastest Python PDF parser (10-100x faster than pdfminer)
  - Handles complex layouts, tables, and multi-column text
  - Works with scanned PDFs that have embedded text layers
  - No external dependencies (pure Python + C extension)
"""

import re
import logging
from typing import Optional

import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# Text Splitter Configuration
# ═══════════════════════════════════════════════════════════════
# Chunk size of 800 chars was chosen because:
#   - Groq's Llama-3.1-8b has 8K context → we send 3 chunks/batch (2400 chars)
#     plus the prompt template, well within limits
#   - 800 chars ≈ 200 tokens ≈ 1-2 paragraphs of dense text
#   - Overlap of 100 chars ensures sentences at boundaries aren't split
_text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],  # Try paragraph → sentence → word
)


def parse_pdf(content: bytes) -> str:
    """
    Extract text from a PDF file's raw bytes.

    Uses PyMuPDF to iterate through all pages and extract text.
    The extracted text is cleaned to remove common PDF artifacts
    like excessive whitespace, page headers/footers, and control characters.

    Args:
        content: Raw bytes of the PDF file.

    Returns:
        Cleaned text extracted from all pages.

    Raises:
        ValueError: If the PDF contains no extractable text.
        RuntimeError: If PyMuPDF fails to open the PDF.
    """
    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        logger.error(f"Failed to open PDF: {e}")
        raise RuntimeError(f"Could not open PDF file: {e}") from e

    pages_text = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        if text.strip():
            pages_text.append(text)
            logger.debug(f"PDF page {page_num}: extracted {len(text)} chars")

    doc.close()

    if not pages_text:
        logger.warning("PDF contained no extractable text")
        raise ValueError(
            "The uploaded PDF contains no extractable text. "
            "It may be a scanned document without an OCR text layer."
        )

    full_text = "\n\n".join(pages_text)
    cleaned = _clean_text(full_text)

    logger.info(
        f"PDF parsed: {len(doc)} pages, {len(cleaned)} chars after cleaning"
    )

    return cleaned


def parse_txt(content: bytes) -> str:
    """
    Decode and clean a plain text file's raw bytes.

    Attempts UTF-8 decoding first, falls back to latin-1 which can
    decode any byte sequence (useful for documents with mixed encoding).

    Args:
        content: Raw bytes of the text file.

    Returns:
        Cleaned text content.

    Raises:
        ValueError: If the file is empty after cleaning.
    """
    # Try UTF-8 first, fall back to latin-1 (which never fails)
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        logger.warning("UTF-8 decode failed, falling back to latin-1")
        text = content.decode("latin-1")

    cleaned = _clean_text(text)

    if not cleaned.strip():
        raise ValueError("The uploaded text file is empty or contains only whitespace.")

    logger.info(f"TXT parsed: {len(cleaned)} chars after cleaning")
    return cleaned


def chunk_text(text: str) -> list[str]:
    """
    Split text into overlapping chunks for embedding.

    Uses LangChain's RecursiveCharacterTextSplitter which tries to split
    on natural boundaries (paragraphs first, then sentences, then words)
    to preserve semantic coherence.

    Args:
        text: The full document text to split.

    Returns:
        List of text chunks, each ~800 chars with 100 char overlap.

    Example:
        >>> chunks = chunk_text("A long document text...")
        >>> len(chunks)  # Depends on text length
        15
        >>> len(chunks[0]) <= 800
        True
    """
    if not text.strip():
        logger.warning("chunk_text called with empty text")
        return []

    chunks = _text_splitter.split_text(text)

    logger.info(
        f"Text chunked: {len(text)} chars → {len(chunks)} chunks "
        f"(avg {len(text) // max(len(chunks), 1)} chars/chunk)"
    )

    return chunks


def detect_file_type(filename: str) -> str:
    """
    Determine file type from filename extension.

    Only PDF and TXT files are accepted. This is validated at the API
    layer as well, but we check here for defense in depth.

    Args:
        filename: Original filename including extension.

    Returns:
        File type string: 'pdf' or 'txt'.

    Raises:
        ValueError: If the file extension is not supported.
    """
    filename_lower = filename.lower().strip()

    if filename_lower.endswith(".pdf"):
        return "pdf"
    elif filename_lower.endswith(".txt"):
        return "txt"
    else:
        raise ValueError(
            f"Unsupported file type: '{filename}'. "
            "Only .pdf and .txt files are accepted."
        )


def parse_file(content: bytes, filename: str) -> str:
    """
    Auto-detect file type and parse accordingly.

    Convenience function that combines detect_file_type with the
    appropriate parser. Used by the ingestion agent.

    Args:
        content: Raw file bytes.
        filename: Original filename for type detection.

    Returns:
        Cleaned text extracted from the file.
    """
    file_type = detect_file_type(filename)

    if file_type == "pdf":
        return parse_pdf(content)
    else:
        return parse_txt(content)


def _clean_text(text: str) -> str:
    """
    Clean extracted text by removing common artifacts.

    Handles issues commonly found in PDF extraction:
      - Multiple consecutive newlines → max 2
      - Multiple spaces → single space
      - Control characters (except newline and tab)
      - Leading/trailing whitespace on each line
      - Non-breaking spaces and other Unicode whitespace

    Args:
        text: Raw extracted text.

    Returns:
        Cleaned text ready for chunking.
    """
    # Replace non-breaking spaces and other Unicode whitespace
    text = text.replace("\xa0", " ")
    text = text.replace("\u200b", "")  # Zero-width space

    # Remove control characters (keep \n and \t)
    text = re.sub(r"[^\S\n\t]+", " ", text)

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse multiple blank lines into max 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Strip leading/trailing whitespace from each line
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)

    # Final trim
    text = text.strip()

    return text
