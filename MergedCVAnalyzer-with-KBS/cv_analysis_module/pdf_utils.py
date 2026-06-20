import fitz  # PyMuPDF
from typing import Union

def extract_text_from_pdf(file_input: Union[str, bytes]) -> str:
    """
    Extracts clean text from a PDF file path or raw bytes.
    """
    try:
        if isinstance(file_input, str):
            # Open from file path
            doc = fitz.open(file_input)
        else:
            # Open from bytes (memory)
            doc = fitz.open(stream=file_input, filetype="pdf")
            
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
            
        # Basic cleanup: Remove unprintable characters
        cleaned_text = "".join(ch for ch in text if ch.isprintable() or ch in "\n\t ")
        return cleaned_text

    except Exception as e:
        return f"Error reading PDF: {str(e)}"