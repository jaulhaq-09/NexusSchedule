"""
ocr_router.py — Production-Grade Timetable OCR Engine v4
=========================================================
Complete rewrite addressing all gaps from v3 analysis:

FIXES vs v3:
  1. Column clustering tolerance scales with image width (80px → width/50)
  2. Time ranges "8:30-9:25" parsed as single token via split on hyphen
  3. Roman numeral rows (I, II, III...) filtered before column detection
  4. "830"/"0830" zero-colon time formats parsed correctly
  5. Row bucket size scales with image height (35px → height/120)
  6. Cell merge gap scales with image width
  7. Day detection scans ALL cells in first 3 columns, not just first 2
  8. Full DAY_ALIASES with SAT, SUN, all 3-letter codes
  9. OCR_CORRECTIONS expanded to 80+ common Indian college subject mis-reads
 10. Subject code split-across-words re-joined ("21CS" + "44" → "21CS44")
 11. Lab detection expanded: "ADA-L", "OS-LAB", "DBMS Lab", "ADA LAB"
 12. Faculty parsed WITHOUT title prefix: "SHARMA K", "PATEL R D"
 13. Multi-faculty labs split on "/" and "\" into list, first name used
 14. Multi-page PDFs: each page parsed separately, results merged by day
 15. dedup() prefers: real faculty > longer subject > first seen
 16. Lab dedup: consecutive same-subject slots collapsed to single span-2 entry
 17. is_noise() allows alphanumeric codes (MC3, OS2, 21CS44)
 18. clean_text() handles Unicode quotes, em-dashes, curly apostrophes
 19. Strategy winner requires minimum quality score (length × avg_word_len)
 20. All subjects normalised to UPPER before return
 21. Per-entry confidence scores added to response
 22. /status endpoint shows detailed capability report
"""

import io
import re
import os
import platform
import statistics
from collections import defaultdict
from typing import Optional, List, Tuple

# ── PIL ───────────────────────────────────────────────────────────────────────
# ── Dependency availability tracking (with real error messages) ───────────────
_MISSING = []

# PIL / Pillow
try:
    from PIL import Image, ImageFilter, ImageEnhance, ImageOps
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False
    _MISSING.append("Pillow      -> pip install Pillow")

# NumPy
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except Exception:
    NUMPY_AVAILABLE = False
    _MISSING.append("numpy       -> pip install numpy")

# OpenCV
try:
    import cv2
    CV2_AVAILABLE = True
except Exception:
    CV2_AVAILABLE = False
    _MISSING.append("opencv      -> pip install opencv-python-headless")

# pytesseract + Tesseract binary
try:
    import pytesseract
    _TESS_FOUND = False
    if platform.system() == "Windows":
        _WIN_PATHS = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Tesseract-OCR", "tesseract.exe"),
            os.path.join(os.environ.get("APPDATA", ""), "Tesseract-OCR", "tesseract.exe"),
        ]
        for _p in _WIN_PATHS:
            if os.path.exists(_p):
                pytesseract.pytesseract.tesseract_cmd = _p
                _TESS_FOUND = True
                break
    if not _TESS_FOUND:
        import shutil as _shutil
        _TESS_FOUND = bool(_shutil.which("tesseract"))
    if _TESS_FOUND:
        try:
            pytesseract.get_tesseract_version()
            OCR_AVAILABLE = PIL_AVAILABLE
            if not PIL_AVAILABLE:
                _MISSING.append("Pillow needed for OCR -> pip install Pillow")
        except Exception as _te:
            OCR_AVAILABLE = False
            _MISSING.append(f"Tesseract binary error: {_te}")
    else:
        OCR_AVAILABLE = False
        _MISSING.append(
            "Tesseract NOT installed!\n"
            "  Windows: https://github.com/UB-Mannheim/tesseract/wiki\n"
            "  Linux:   sudo apt install tesseract-ocr\n"
            "  Mac:     brew install tesseract"
        )
except Exception as _pe:
    OCR_AVAILABLE = False
    _MISSING.append(f"pytesseract -> pip install pytesseract  (error: {_pe})")

# pdf2image
try:
    from pdf2image import convert_from_bytes
    PDF_AVAILABLE = True
except Exception:
    PDF_AVAILABLE = False
    _MISSING.append("pdf2image   -> pip install pdf2image")

# pdfplumber — text-based PDF reading (no poppler needed)
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except Exception:
    PDFPLUMBER_AVAILABLE = False
    _MISSING.append("pdfplumber  -> pip install pdfplumber")

# python-docx
try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except Exception:
    DOCX_AVAILABLE = False
    _MISSING.append("python-docx -> pip install python-docx")

# openpyxl — Excel (.xlsx / .xls) support
try:
    import openpyxl
    XLSX_AVAILABLE = True
except Exception:
    XLSX_AVAILABLE = False
    _MISSING.append("openpyxl    -> pip install openpyxl")

# Print clear startup diagnostic
if _MISSING:
    print("\n" + "="*60)
    print("  [OCR] MISSING DEPENDENCIES:")
    for _m in _MISSING:
        print(f"  x {_m}")
    print("\n  Quick fix:")
    print("  pip install pytesseract Pillow opencv-python-headless numpy pdf2image python-docx openpyxl")
    print("="*60 + "\n")
else:
    print("[OCR] All dependencies OK")

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends
from app.routes.auth_routes import get_current_user
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/ocr", tags=["OCR"], dependencies=[Depends(get_current_user)])

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

MAX_FILE_SIZE_MB    = 20
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_PDF_PAGES       = 15
MIN_IMAGE_WIDTH     = 300
MIN_IMAGE_HEIGHT    = 150
TARGET_LONG_EDGE    = 4000

TIME_SLOTS = [
    "08:30 - 09:25",
    "09:25 - 10:20",
    "10:40 - 11:35",
    "11:35 - 12:30",
    "01:25 - 02:20",
    "02:20 - 03:15",
    "03:15 - 04:10",
]

# Minutes that are BREAK/LUNCH — must not map to any slot
BREAK_MINUTE_VALUES = {
    610, 615, 620, 625, 630,   # 10:10–10:30 break band
    740, 745, 750, 755, 760,   # 12:20–12:40 lunch band
}

# ── FIX 8: Complete day aliases including 3-letter ALL-CAPS ──
DAY_ALIASES = {
    "mon": "Monday",    "monday": "Monday",
    "tue": "Tuesday",   "tuesday": "Tuesday",  "tues": "Tuesday",
    "wed": "Wednesday", "wednesday": "Wednesday", "weds": "Wednesday",
    "thu": "Thursday",  "thursday": "Thursday", "thur": "Thursday", "thurs": "Thursday",
    "fri": "Friday",    "friday": "Friday",
    "sat": "Saturday",  "saturday": "Saturday",
    "sun": "Sunday",    "sunday": "Sunday",
}

SKIP_WORDS = {
    "break", "lunch", "recess", "holiday", "—", "-", "·", ".", "",
    "nil", "free", "off", "not assigned", "lab staff", "|", "_",
    "b", "r", "e", "a", "k", "l", "u", "n", "c", "h",
    "slot", "period", "time", "day", "subject", "faculty", "code",
    "theory", "practical", "hours", "credits", "total",
}

# ── FIX 9: Expanded OCR corrections — 80+ entries for Indian college timetables ──
OCR_CORRECTIONS = {
    # DBMS variants
    "OMS": "DBMS",   "OBMS": "DBMS",  "OAMS": "DBMS",  "ODBMS": "DBMS",
    "DEMS": "DBMS",  "DAMS": "DBMS",  "D8MS": "DBMS",  "DB8S": "DBMS",
    # ADA / algorithms
    "HOA": "ADA",    "AOA": "ADA",    "AQA": "ADA",    "ACA": "ADA",
    "AUA": "ADA",    "AOA": "ADA",
    # OS
    "05": "OS",      "O5": "OS",      "0S": "OS",
    # CN / Networks
    "GN": "CN",      "€N": "CN",      "ON": "CN",
    # SE / Software Engineering
    "5E": "SE",      "SE_": "SE",
    # Maths
    "MATHS": "MATH", "MAT5": "MATH",  "MATNS": "MATH",
    # MC / Microcontrollers
    "Me": "MC",      "mc": "MC",      "Mc": "MC",      "M€": "MC",
    # DMS
    "ams": "DMS",
    # Python
    "PVTHON": "PYTHON", "PYTHN": "PYTHON",
    # Java
    "JAUA": "JAVA",  "JAV": "JAVA",
    # BMS-IT specific subjects
    "MCL": "MCL",
    "ADAL": "ADAL",
    "DBMSL": "DBMSL",
    "BIT": "BIT",
    "UHV": "UHV",
    "DIP": "DIP",
    "SDL": "SDL",
    # BMS-IT OCR misreads found in real output
    "DEMS": "DBMS",    # DBMS misread as DEMS
    "OUNV": "UHV",     # UHV misread as OUNV
    "PMS": "MC",       # MC misread as PMS (context: slot after ADA on Monday)
    "MC:": "MC",       # MC with trailing colon
    "DBMSL.C2": "DBMSL-C2",  # dot instead of hyphen
    "DBMSL.C1": "DBMSL-C1",
    "ADAL.C1": "ADAL-C1",
    "ADAL.C2": "ADAL-C2",
    # Subject name cleanup
    "DMS": "DMS",    # keep Discrete Math
    "DEMS": "DBMS",  # common OCR swap
    "MC:": "MC",
    "BIT:": "BIT",
    "ADA:": "ADA",
    "DMS:": "DMS",
    "OUNV": "UHV",
    "UNV": "UHV",
    "UHYV": "UHV",
    "UBMS": "DBMS",
    "(C+": "C++",
    "C+": "C++",
    "DBMSL.C2": "DBMSL-C2",
    "DBMSL.C1": "DBMSL-C1",
    "ADAL.C1": "ADAL-C1",
    # Common noise
    "Kk": "",  "°": "",  "=": "",  "7": "",  "al": "",
    "|": "",   "||": "", "—": "",  "–": "",  "…": "",
    # OCR digit/letter swaps
    "1T": "IT",  "I1": "IT",  "l1": "IT",
    "C5": "CS",  "C$": "CS",
    "EEE": "EEE",   # keep as-is
    "ECE": "ECE",
    "CSE": "CSE",
    "ISE": "ISE",
    "AIML": "AIML",
    "AIDS": "AIDS",  # AI & DS
    "CVS": "CVS",
    # Subject name OCR corruptions
    "COMP": "COMP",
    "COMPILOR": "COMPILER",
    "COMPILAR": "COMPILER",
    "MICROPROC": "MICROPROCESSOR",
    "MICROPROCS": "MICROPROCESSOR",
    "DATASTRUCTS": "DATA STRUCTURES",
    "DATASTR": "DS",
    "DISCREATE": "DISCRETE",
    "DISCRET": "DISCRETE",
    "STATICTS": "STATISTICS",
    "STATIST": "STATISTICS",
}

# Roman numerals to skip in column header rows
ROMAN_NUMERALS = {"I","II","III","IV","V","VI","VII","VIII","IX","X",
                  "XI","XII","i","ii","iii","iv","v","vi","vii","viii","ix","x"}


# ══════════════════════════════════════════════════════════════════════════════
# VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

class ValidationError(Exception):
    def __init__(self, message: str, code: int = 422):
        self.message = message
        self.code    = code
        super().__init__(message)


def validate_file(filename: str, content_type: str, raw_bytes: bytes) -> dict:
    info       = {}
    size_bytes = len(raw_bytes)
    ext        = os.path.splitext(filename.lower())[1] if filename else ""

    if size_bytes == 0:
        raise ValidationError("File is empty.", 400)
    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise ValidationError(
            f"File too large: {size_bytes/1024/1024:.1f} MB. Max is {MAX_FILE_SIZE_MB} MB.", 413
        )
    info["size_mb"] = round(size_bytes / 1024 / 1024, 2)

    is_pdf   = "pdf" in content_type or ext == ".pdf"
    is_docx  = ext in (".docx", ".doc") or "word" in content_type or "msword" in content_type
    is_xlsx  = ext in (".xlsx", ".xls") or "spreadsheet" in content_type or "excel" in content_type or "officedocument.spreadsheet" in content_type
    is_image = (
        any(x in content_type for x in ["image/", "jpeg", "png", "webp", "bmp", "tiff"])
        or ext in {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}
    )

    if not (is_pdf or is_docx or is_xlsx or is_image):
        raise ValidationError(
            f"Unsupported file '{ext}'. Allowed: JPEG, PNG, BMP, TIFF, WEBP, PDF, DOCX, XLSX.", 415
        )

    info["file_type"] = "pdf" if is_pdf else "docx" if is_docx else "xlsx" if is_xlsx else "image"
    info["extension"] = ext
    return info


def validate_image_dimensions(img) -> dict:
    w, h     = img.size
    info     = {"width": w, "height": h}
    warnings = []
    if w < MIN_IMAGE_WIDTH or h < MIN_IMAGE_HEIGHT:
        raise ValidationError(
            f"Image too small: {w}x{h}px. Minimum {MIN_IMAGE_WIDTH}x{MIN_IMAGE_HEIGHT}px.", 422
        )
    if NUMPY_AVAILABLE:
        try:
            arr     = np.array(img.convert("L"), dtype=np.float32)
            lap_var = float(np.var(np.gradient(np.gradient(arr))))
            info["sharpness_score"] = round(lap_var, 1)
            if lap_var < 30:
                warnings.append(
                    f"Image appears blurry (sharpness: {lap_var:.0f}). "
                    "Use a >=150 DPI scan with good lighting."
                )
        except Exception:
            pass
    info["warnings"] = warnings
    return info


# ══════════════════════════════════════════════════════════════════════════════
# IMAGE PREPROCESSING
# ══════════════════════════════════════════════════════════════════════════════

def _upscale(img, target: int = TARGET_LONG_EDGE):
    w, h = img.size
    if max(w, h) >= target:
        return img
    scale = target / max(w, h)
    return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def _auto_rotate(img):
    try:
        exif = img._getexif()
        if exif:
            rot = {3: 180, 6: 270, 8: 90}.get(exif.get(274))
            if rot:
                img = img.rotate(rot, expand=True)
    except Exception:
        pass
    return img


def _deskew(img):
    """Correct slight rotation using Hough lines (OpenCV)."""
    if not (CV2_AVAILABLE and NUMPY_AVAILABLE):
        return img
    try:
        arr   = np.array(img.convert("L"))
        edges = cv2.Canny(arr, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=200)
        if lines is None or len(lines) < 3:
            return img
        angles = []
        for line in lines[:20]:
            rho, theta = line[0]
            angle = (theta - np.pi / 2) * 180 / np.pi
            if abs(angle) < 15:
                angles.append(angle)
        if not angles:
            return img
        median_angle = float(np.median(angles))
        if abs(median_angle) < 0.5:
            return img
        return img.rotate(-median_angle, expand=True, fillcolor=255)
    except Exception:
        return img


def preprocess_bilateral(img):
    img  = _deskew(_auto_rotate(_upscale(img)))
    arr  = np.array(img.convert("L"))
    blur = cv2.bilateralFilter(arr, 9, 75, 75)
    _, t = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(t)


def preprocess_adaptive(img):
    img   = _deskew(_auto_rotate(_upscale(img)))
    arr   = np.array(img.convert("L"))
    blur  = cv2.medianBlur(arr, 3)
    thresh = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
    )
    return Image.fromarray(thresh)


def preprocess_clahe(img):
    img   = _deskew(_auto_rotate(_upscale(img)))
    arr   = np.array(img.convert("L"))
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    eq    = clahe.apply(arr)
    _, t  = cv2.threshold(eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(t)


def preprocess_morphology(img):
    """Extra pass: morphological close to repair broken characters."""
    img   = _deskew(_auto_rotate(_upscale(img)))
    arr   = np.array(img.convert("L"))
    _, t  = cv2.threshold(arr, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kern  = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    t     = cv2.morphologyEx(t, cv2.MORPH_CLOSE, kern)
    return Image.fromarray(cv2.bitwise_not(t))


def preprocess_pil_only(img):
    img = _auto_rotate(_upscale(img))
    img = img.convert("L")
    img = ImageOps.autocontrast(img, cutoff=2)
    img = ImageEnhance.Contrast(img).enhance(2.8)
    img = ImageEnhance.Sharpness(img).enhance(2.5)
    img = img.filter(ImageFilter.SHARPEN)
    return img


def get_preprocessors():
    if CV2_AVAILABLE and NUMPY_AVAILABLE:
        return [preprocess_bilateral, preprocess_adaptive,
                preprocess_clahe, preprocess_morphology]
    return [preprocess_pil_only]


# ══════════════════════════════════════════════════════════════════════════════
# TIME HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _parse_time_minutes(raw: str) -> Optional[int]:
    """
    Parse time string → total minutes.
    Handles: "8:30", "8.30", "8.30-9.25", "830", "0830",
             "11.35.-12.30" (extra dot), "1.25" as PM (13:25).
    """
    raw = re.sub(r"[aApP][mM]", "", raw).strip()
    # Split range "8:30-9:25" or "8.30-9.25" → take start
    raw = re.split(r"\s*[-–—]\s*", raw)[0].strip()
    # Remove trailing stray dots e.g. "11.35." → "11.35"
    raw = raw.rstrip(".")
    # Normalise dot/space separators to colon
    raw = raw.replace(".", ":").replace(" ", ":")
    # Remove double colons from "11:35:" → "11:35"
    raw = re.sub(r":{2,}", ":", raw).rstrip(":")
    # Handle "830" or "0830" (3-4 digit no colon)
    if re.match(r"^\d{3,4}$", raw):
        raw = (raw[0] + ":" + raw[1:]) if len(raw) == 3 else (raw[:2] + ":" + raw[2:])
    m = re.match(r"^(\d{1,2}):(\d{2})", raw)
    if not m:
        return None
    h, mn = int(m.group(1)), int(m.group(2))
    # College timetables: h=1..7 are afternoon (PM) slots
    # 12:30 lunch → h=12 stays as-is; 1:25 PM → h=1+12=13
    if 1 <= h <= 7:
        h += 12
    if mn >= 60:
        return None
    return h * 60 + mn


def _minutes_to_slot(minutes: int) -> Optional[str]:
    """Return nearest canonical TIME_SLOT (tolerance ±40 min)."""
    best, best_diff = None, 9999
    for s in TIME_SLOTS:
        sv = _parse_time_minutes(s.split(" - ")[0])
        if sv is None:
            continue
        d = abs(minutes - sv)
        if d < best_diff:
            best, best_diff = s, d
    return best if best_diff <= 40 else None


# ══════════════════════════════════════════════════════════════════════════════
# WORD EXTRACTION + ROW GROUPING
# ══════════════════════════════════════════════════════════════════════════════

def ocr_words_best(img) -> list:
    """Run Tesseract with all preprocessors; return words from best run."""
    best_words  = []
    best_score  = 0
    for preproc in get_preprocessors():
        try:
            data = pytesseract.image_to_data(
                preproc(img),
                output_type=pytesseract.Output.DICT,
                config="--psm 6 --oem 3 -c tessedit_char_whitelist="
                       "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
                       "0123456789.:/-()& ",
            )
            words = []
            for i in range(len(data["text"])):
                t    = data["text"][i].strip()
                conf = int(data["conf"][i]) if str(data["conf"][i]).lstrip("-").isdigit() else -1
                if not t or conf < 15:
                    continue
                words.append({
                    "t": t, "l": data["left"][i], "top": data["top"][i],
                    "w": data["width"][i], "h": data["height"][i], "conf": conf,
                })
            # FIX 19: score = word count × mean word length (avoids short garbage)
            score = len(words) * (sum(len(w["t"]) for w in words) / max(len(words), 1))
            if score > best_score:
                best_score = score
                best_words = words
        except Exception:
            continue
    return sorted(best_words, key=lambda x: (x["top"], x["l"]))


def _adaptive_bucket(img_height: int) -> int:
    """FIX 5: Row bucket size scales with image height."""
    return max(20, img_height // 120)


def _adaptive_gap(img_width: int) -> int:
    """FIX 6: Cell merge gap scales with image width."""
    return max(40, img_width // 80)


def group_into_rows(words: list, img_height: int = 4000) -> list:
    bucket = _adaptive_bucket(img_height)
    rm     = defaultdict(list)
    for w in words:
        rm[(w["top"] // bucket) * bucket].append(w)
    return [sorted(v, key=lambda x: x["l"]) for _, v in sorted(rm.items())]


def merge_row_cells(row: list, gap: int = 55) -> list:
    """Merge adjacent words into cells. Returns [(x_left, text), ...]."""
    if not row:
        return []
    cells, cur = [], [row[0]]
    for i in range(1, len(row)):
        if row[i]["l"] - (cur[-1]["l"] + cur[-1]["w"]) > gap:
            cells.append((cur[0]["l"], " ".join(c["t"] for c in cur).strip()))
            cur = [row[i]]
        else:
            cur.append(row[i])
    if cur:
        cells.append((cur[0]["l"], " ".join(c["t"] for c in cur).strip()))
    return cells


# ══════════════════════════════════════════════════════════════════════════════
# TEXT UTILITIES
# ══════════════════════════════════════════════════════════════════════════════

def clean_text(text: str) -> str:
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2014", " ").replace("\u2013", "-")
    text = text.replace("\u00b0", "").replace("\u00a0", " ")
    text = re.sub(r"[|\\]{2,}", " ", text)
    text = re.sub(r"^\s*[|_.\-=\"\']+\s*$", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Strip OCR noise: leading quote/bracket, trailing colon
    text = text.lstrip("'\"'[( ")
    text = text.rstrip(":)\"' ")
    return OCR_CORRECTIONS.get(text.strip(), text.strip())

def is_noise(text: str) -> bool:
    if not text or len(text) < 2:
        return True
    if text.lower() in SKIP_WORDS:
        return True
    # FIX 17: allow alphanumeric codes like "MC3", "OS2", "21CS44"
    if re.match(r"^[A-Z0-9]{2,10}$", text, re.I):
        return False
    alpha = sum(1 for c in text if c.isalpha())
    return len(text) > 1 and alpha / len(text) < 0.20


def is_roman_numeral_row(cells: list) -> bool:
    """FIX 3: Detect rows that are purely Roman numeral column headers."""
    if not cells:
        return False
    non_empty = [t for _, t in cells if t.strip()]
    if not non_empty:
        return False
    return all(t.strip() in ROMAN_NUMERALS for t in non_empty)


def detect_day(text: str) -> Optional[str]:
    t = re.sub(r"[^a-z]", "", text.strip().lower())
    if t in DAY_ALIASES:
        return DAY_ALIASES[t]
    for alias in sorted(DAY_ALIASES.keys(), key=len, reverse=True):
        if t.startswith(alias) and len(t) <= len(alias) + 4:
            return DAY_ALIASES[alias]
    return None


def is_lab_entry(text: str) -> bool:
    # Expanded lab patterns including MCL, ADAL, SDL, DIP formats
    patterns = [
        r"\blab\b",
        r"-L\b",
        r"\bL\b",
        r"[A-Z]{2,8}-LAB",
        r"[A-Z]{2,8}L-C\d+",          # ADAL-C1-HKN
        r"[A-Z]{2,8}L?-[A-Z]{2,6}/",  # MCL-MBA/SS
        r"^[A-Z]{2,5}L\b",            # MCL, ADAL, DBMSL at word start
        r"\bpractical\b",
        r"\bprac\b",
        r"\bSDL\b",                    # Skill Development Lab
        r"\bDIP\b",                    # Diploma sessions sometimes lab-like
        r"[A-Z]{2,8}SL\b",            # DBMSL
        r"-C\d+-[A-Z]{2,6}",          # C1-HKN, C2-AHR patterns
    ]
    for p in patterns:
        if re.search(p, text, re.I):
            return True
    return False


def parse_lab_name(text: str) -> str:
    # ADA-L, OS-LAB, DBMS Lab → "ADA", "OS", "DBMS"
    m = re.match(r"^([A-Z]{2,10})-?L(?:AB)?\b", text.strip(), re.I)
    if m:
        return m.group(1).upper()
    m = re.match(r"^([A-Z]{2,10})-C\d+", text.strip(), re.I)
    if m:
        return m.group(1).upper()
    # "ADA LAB" or "OS LAB"
    m = re.match(r"^([A-Z]{2,10})\s+LAB\b", text.strip(), re.I)
    if m:
        return m.group(1).upper()
    return text.upper().replace("LAB", "").strip(" -_")


# FIX 10: Re-join subject codes split across words ("21CS" "44" → "21CS44")
def rejoin_subject_codes(cells: list) -> list:
    """Merge adjacent cells that look like split subject codes."""
    result = []
    i = 0
    while i < len(cells):
        x, t = cells[i]
        if i + 1 < len(cells):
            nx, nt = cells[i + 1]
            # Pattern: ends with letters, next is digits (or vice versa)
            if re.match(r"^[A-Z]{2,6}$", t, re.I) and re.match(r"^\d{2,3}[A-Z]?$", nt):
                result.append((x, t + nt))
                i += 2
                continue
        result.append((x, t))
        i += 1
    return result


# ══════════════════════════════════════════════════════════════════════════════
# FACULTY EXTRACTION  (FIX 12 + 13)
# ══════════════════════════════════════════════════════════════════════════════

# Pattern 1: titled faculty "Prof. Sharma", "Dr. A.B. Patel"
_FAC_TITLED = re.compile(
    r"(?:Dr\.?|Prof\.?|Ms\.?|Mr\.?|Mrs\.?|Er\.?|Smt\.?|Shri\.?)\s*"
    r"[A-Z][a-zA-Z''\-]{1,25}"
    r"(?:\s+[A-Z][a-zA-Z''\-]{1,25}){0,3}",
    re.I,
)

# Pattern 2: "LASTNAME INITIALS" format, e.g. "SHARMA K", "PATEL R D"
_FAC_INITIALS = re.compile(
    r"\b([A-Z]{3,15})\s+([A-Z](?:\s+[A-Z])?)\b"
)

# Pattern 3: "First Last" format (Title Case)
_FAC_TITLE_CASE = re.compile(
    r"\b([A-Z][a-z]{2,15})\s+([A-Z][a-z]{2,15})\b"
)


def extract_faculty_name(text: str) -> Optional[str]:
    # Fix OCR merge: "ProfSharma" → "Prof Sharma"
    text = re.sub(r"\b(Dr|Prof|Ms|Mr|Mrs|Er|Smt|Shri)([A-Z][a-z])", r"\1 \2", text)

    # FIX 13: split multi-faculty on "/" or "\" → take first real name
    parts = re.split(r"\s*/\s*|\s*\\\s*", text)

    for part in parts:
        part = part.strip()

        # Strategy A: titled name
        m = _FAC_TITLED.search(part)
        if m:
            result = _trim_trailing_caps(m.group(0))
            if len(result) > 4:
                return result

        # Strategy B: ALL-CAPS LASTNAME INITIAL (e.g. "DURGA DEVI G Y")
        m = _FAC_INITIALS.search(part)
        if m:
            candidate = m.group(0).strip()
            if 4 < len(candidate) < 35:
                return candidate.title()

        # Strategy C: Title Case two words
        m = _FAC_TITLE_CASE.search(part)
        if m:
            candidate = m.group(0).strip()
            if 4 < len(candidate) < 35 and candidate.split()[0].lower() not in SKIP_WORDS:
                return candidate

    return None


def _trim_trailing_caps(text: str) -> str:
    """Remove trailing ALL-CAPS abbreviations like 'GY', 'MBA/SS'."""
    parts = text.split()
    clean = []
    for p in parts:
        if len(clean) > 1 and p.isupper() and len(p) <= 3 and "." not in p:
            break
        clean.append(p)
    return " ".join(clean).strip("._-/ ")


def split_multi_faculty(text: str) -> List[str]:
    """FIX 13: Split 'Prof A / Prof B / Prof C' into list."""
    parts = re.split(r"\s*/\s*|\s*\\\s*|\s*&\s*", text)
    result = []
    for p in parts:
        f = extract_faculty_name(p.strip())
        if f:
            result.append(f)
    return result if result else []


# ══════════════════════════════════════════════════════════════════════════════
# CORE TIMETABLE PARSER
# ══════════════════════════════════════════════════════════════════════════════

class TimetableParser:

    def __init__(self, img_width: int = 4000, img_height: int = 3000):
        self.img_width   = img_width
        self.img_height  = img_height
        self.col_map:    dict = {}
        self.break_xs:   set  = set()
        self.entries:    list = []
        self.fac_map:    dict = {}
        self.raw_text:   str  = ""
        self._header_end:int  = 0
        # adaptive gap for this image
        self._gap = _adaptive_gap(img_width)

    # ── Column detection (FIX 1, 2, 3, 4) ────────────────────────────────────

    def _merge_split_header_rows(self, rows: list) -> list:
        """
        BMS-IT timetable has a TWO-ROW column header:
          Row A: I   II   [10.20-]   III   IV   [12.30-1.25]   V   VI   VII
          Row B: 8.30-9.25  9.25-10.20  10.40  10.40-11.35  11.35-12.30 ...
        Both rows need to be scanned for time tokens. We don't actually
        merge them — we just ensure _build_col_map scans wide enough.
        This method also removes pure single-letter rows (B,R,E,A,K verticals).
        """
        time_re = re.compile(r"\d{1,2}[.:]\d{2}")
        cleaned = []
        for row in rows:
            cells = merge_row_cells(row, gap=self._gap)
            texts = [t for _, t in cells if t.strip()]
            # Drop rows that are all single-letter (vertical BREAK/LUNCH text)
            if texts and all(len(t.strip()) == 1 for t in texts):
                continue
            cleaned.append(row)
        return cleaned

    def _build_col_map(self, rows: list) -> None:
        """
        Build X→time_slot column map.
        BMS-IT FIX: time header is split across TWO rows:
          Row N:   Roman numerals (I, II, ...) + partial times like "10.20-"
          Row N+1: Full times "8.30-9.25", "9.25-10.20", "10.40-11.35" ...
        We scan BOTH rows and cluster all time tokens by X centroid.
        Vertical BREAK text (B,R,E,A,K each on own row) is silently ignored
        because single letters fail the time regex.
        """
        cluster_tol  = max(80, self.img_width // 50)
        search_limit = max(20, len(rows) // 3)  # wider search for split headers
        time_re      = re.compile(
            r"(\d{1,2}[.:]\d{2}\.?(?:\s*[-–]\s*\d{1,2}[.:]\d{2})?)"  # range or single
            r"|(\d{3,4})\b"  # "830", "0830"
        )
        time_tokens = []

        for ri, row in enumerate(rows[:search_limit]):
            cells = merge_row_cells(row, gap=self.img_width // 60)
            # Skip pure Roman numeral rows (I II III header)
            if is_roman_numeral_row(cells):
                continue
            # Skip rows with only single-letter cells (vertical BREAK text)
            non_empty = [t for _, t in cells if t.strip()]
            if non_empty and all(len(t.strip()) <= 1 for t in non_empty):
                continue

            for w in row:
                for match in time_re.finditer(w["t"]):
                    raw_t = match.group(0)
                    mins  = _parse_time_minutes(raw_t)
                    if mins is not None and 400 <= mins <= 1200:
                        time_tokens.append((w["l"] + w["w"] // 2, mins))
                        self._header_end = max(self._header_end, ri)

        if not time_tokens:
            return

        # Cluster tokens
        time_tokens.sort(key=lambda x: x[0])
        clusters = []
        for x, mins in time_tokens:
            placed = False
            for cl in clusters:
                if abs(cl[-1][0] - x) < cluster_tol:
                    cl.append((x, mins))
                    placed = True
                    break
            if not placed:
                clusters.append([(x, mins)])

        for cl in clusters:
            rep_x = int(sum(c[0] for c in cl) / len(cl))
            mins_list = [c[1] for c in cl]
            try:
                rep_min = statistics.mode(mins_list)
            except Exception:
                rep_min = int(statistics.mean(mins_list))

            if rep_min in BREAK_MINUTE_VALUES:
                self.break_xs.add(rep_x)
                continue

            slot = _minutes_to_slot(rep_min)
            if slot:
                self.col_map[rep_x] = slot
            else:
                self.break_xs.add(rep_x)

    def _x_to_slot(self, x: int) -> Optional[str]:
        if not self.col_map:
            return None
        best_x    = min(self.col_map.keys(), key=lambda cx: abs(cx - x))
        best_dist = abs(best_x - x)
        # Wider tolerance for multi-line merged cells (lab entries span wide columns)
        col_width = self.img_width // max(len(self.col_map), 1)
        tolerance = max(220, col_width * 2 // 3)
        if best_dist > tolerance:
            return None
        if self.break_xs:
            nearest_break_dist = min(abs(bx - x) for bx in self.break_xs)
            if nearest_break_dist < best_dist - 30:  # give 30px grace vs break col
                return None
        return self.col_map[best_x]

    def _flush_day(self, day: str, acc: dict) -> None:
        for slot, texts in acc.items():
            # Join all text fragments for this slot
            combined = " / ".join(
                t for t in texts
                if t and not is_noise(t) and t.lower() not in SKIP_WORDS
            ).strip()
            combined = clean_text(combined)
            if not combined or len(combined) < 2:
                continue
            lab     = is_lab_entry(combined)
            subject = parse_lab_name(combined) if lab else combined.upper()
            subject = re.sub(r"\s+", " ", subject).strip(" .-\u2014_|\\")
            subject = OCR_CORRECTIONS.get(subject, subject)
            if not subject or len(subject) < 2 or subject.lower() in SKIP_WORDS:
                continue
            self.entries.append({
                "day":         day,
                "time":        slot,
                "subject":     subject,
                "facultyName": "\u2014",
                "isLab":       lab,
                "span":        2 if lab else 1,
                "confidence":  80,
            })

    def _parse_grid(self, rows: list) -> None:
        current_day = None
        day_acc     = defaultdict(list)

        for row_idx, row in enumerate(rows[self._header_end + 1:], start=self._header_end + 1):
            if not row:
                continue

            cells    = rejoin_subject_codes(merge_row_cells(row, gap=self._gap))
            row_text = " ".join(t for _, t in cells)
            row_low  = row_text.lower()

            # Skip pure Roman numeral rows
            if is_roman_numeral_row(cells):
                continue
            # Skip vertical BREAK/LUNCH text (single-letter rows)
            non_empty_cells = [t for _, t in cells if t.strip()]
            if non_empty_cells and all(len(t.strip()) <= 1 for t in non_empty_cells):
                continue

            # Detect faculty table header (SUBJECT / CODE / FACULTY)
            is_subj_hdr = bool(re.search(r"sub[ij]ect|subiect", row_low))
            is_fac_hdr  = bool(re.search(r"\bfaculty\b|\bcode\b|\bincharge\b", row_low))
            has_codes   = bool(re.search(r"\b[A-Z]{2,4}\d{3}[A-Z]?\b", row_text))
            if is_subj_hdr and (is_fac_hdr or has_codes):
                if current_day:
                    self._flush_day(current_day, day_acc)
                self._parse_faculty_table(rows, row_idx + 1)
                return

            # Scan first 3 cells for day name
            new_day = None
            for cx, ct in cells[:3]:
                new_day = detect_day(ct)
                if new_day:
                    break

            if new_day:
                if current_day:
                    self._flush_day(current_day, day_acc)
                day_acc     = defaultdict(list)
                current_day = new_day

            # Saturday/Sunday rows: keep only non-lab short entries
            if current_day is None:
                continue
            if current_day in ("Saturday", "Sunday"):
                # Still check for faculty table trigger on Saturday rows
                continue

            for cx, ct in cells:
                ct2 = clean_text(ct)
                if not ct2 or is_noise(ct2):
                    continue
                if detect_day(ct2):
                    continue
                if re.search(r"\b(break|lunch|recess)\b", ct2, re.I):
                    continue
                if ct2.strip() in ROMAN_NUMERALS:
                    continue
                slot = self._x_to_slot(cx)
                if not slot:
                    continue
                day_acc[slot].append(ct2)

        if current_day:
            self._flush_day(current_day, day_acc)

    # ── Faculty table (FIX 12, 13) ───────────────────────────────────────────

    def _parse_faculty_table(self, rows: list, start_idx: int) -> None:
        """
        Parse subject→faculty mapping table.
        Handles BMS-IT 4-column format:
          SUBJECT | CODE | FACULTY | FACULTY FOR PRACTICAL
        Both theory and practical faculty are stored in fac_map.
        """
        abbr_re   = re.compile(r"\(([A-Z]{2,12}(?:\s+[A-Z]{2,5})?)\)")
        code_re   = re.compile(r"\b([A-Z]{2,4}\d{3}[A-Z]?)\b")
        prev_abbr = None

        for row in rows[start_idx:]:
            if not row:
                continue
            cells    = merge_row_cells(row, gap=40)
            row_text = " ".join(t for _, t in cells)

            # Stop at signature line
            if re.search(r"timetable.officer|principal|\bhod\b|dean|signature|officer", row_text, re.I):
                break
            # Skip header row itself
            if re.search(r"\bsubject\b.*\bfaculty\b|\bfaculty\b.*\bcode\b", row_text, re.I):
                continue

            ab_m  = abbr_re.search(row_text)
            abbr  = ab_m.group(1).strip().upper() if ab_m else None
            if not abbr:
                cd_m = code_re.search(row_text)
                abbr = cd_m.group(1) if cd_m else None

            # Get ALL faculty mentions (theory + practical)
            faculty_list = split_multi_faculty(row_text)
            faculty      = faculty_list[0] if faculty_list else extract_faculty_name(row_text)

            # FIX: also capture practical faculty (4th column)
            # Practical faculty often listed after the theory faculty on same row
            prac_fac = faculty_list[1] if len(faculty_list) > 1 else None

            if not faculty and prev_abbr:
                faculty = extract_faculty_name(row_text)
                if faculty:
                    self.fac_map[prev_abbr] = faculty
                    prev_abbr = None
                    continue

            if abbr and faculty:
                self.fac_map[abbr] = faculty
                # Map lab variant too: "ADALAB"/"ADA LAB"/"ADAL" all → same faculty
                if "LAB" in abbr:
                    base = re.sub(r"\s*LAB\s*", "", abbr).strip()
                    self.fac_map[base] = prac_fac or faculty
                    self.fac_map[base + "L"] = prac_fac or faculty
                    self.fac_map[base + "LAB"] = prac_fac or faculty
                # Store practical faculty under "<ABBR>_PRAC" key
                if prac_fac:
                    self.fac_map[abbr + "_PRAC"] = prac_fac
                prev_abbr = None
            elif abbr:
                prev_abbr = abbr
            else:
                prev_abbr = None

    # ── Faculty backfill ─────────────────────────────────────────────────────

    def _backfill_faculty(self) -> None:
        for entry in self.entries:
            if entry["facultyName"] != "—":
                continue
            subj = entry["subject"].upper()

            # Exact match
            if subj in self.fac_map:
                entry["facultyName"] = self.fac_map[subj]
                entry["confidence"]  = min(entry.get("confidence", 80) + 10, 95)
                continue

            # Prefix match (3+ chars)
            for abbr, fac in self.fac_map.items():
                if len(abbr) >= 3 and (subj.startswith(abbr) or abbr.startswith(subj[:3])):
                    entry["facultyName"] = fac
                    break

    # ── Positional fallback ───────────────────────────────────────────────────

    def _positional_fallback(self, rows: list) -> list:
        entries = []
        for row in rows:
            cells = rejoin_subject_codes(merge_row_cells(row, gap=self._gap))
            if not cells:
                continue
            day = None
            for cx, ct in cells[:3]:
                day = detect_day(ct)
                if day:
                    break
            if not day or day in ("Saturday", "Sunday"):
                continue
            subj_cells = [(cx, ct) for cx, ct in cells if not detect_day(ct)]
            slot_idx   = 0
            for cx, ct in subj_cells:
                if slot_idx >= len(TIME_SLOTS):
                    break
                ct2 = clean_text(ct)
                if not ct2 or is_noise(ct2):
                    slot_idx += 1
                    continue
                if re.search(r"\b(break|lunch|recess)\b", ct2, re.I):
                    continue
                lab     = is_lab_entry(ct2)
                subject = parse_lab_name(ct2) if lab else ct2.upper()
                subject = OCR_CORRECTIONS.get(subject, subject)
                entries.append({
                    "day":         day,
                    "time":        TIME_SLOTS[slot_idx],
                    "subject":     subject.strip(" .-—_|/\\"),
                    "facultyName": "—",
                    "isLab":       lab,
                    "span":        2 if lab else 1,
                    "confidence":  50,
                })
                slot_idx += 1
        return entries

    # ── Main entry ────────────────────────────────────────────────────────────

    def parse(self, img) -> list:
        w, h = img.size
        self.img_width  = w
        self.img_height = h
        self._gap       = _adaptive_gap(w)

        words = ocr_words_best(img)
        if not words:
            return []

        try:
            self.raw_text = pytesseract.image_to_string(
                get_preprocessors()[0](img), config="--psm 6 --oem 3"
            )
        except Exception:
            self.raw_text = ""

        rows = group_into_rows(words, img_height=h)
        # BMS-IT FIX: merge consecutive rows that together form the time header
        # e.g. Row A has Roman numerals, Row B has actual times → merge X positions
        rows = self._merge_split_header_rows(rows)
        self._build_col_map(rows)

        if self.col_map:
            self._parse_grid(rows)
        else:
            self.entries = self._positional_fallback(rows)

        self._backfill_faculty()
        return self.entries


# ══════════════════════════════════════════════════════════════════════════════
# RAW TEXT FALLBACK
# ══════════════════════════════════════════════════════════════════════════════

def parse_raw_text_lines(raw: str) -> list:
    entries = []
    for line in raw.splitlines():
        line   = line.strip()
        tokens = line.split()
        if not tokens:
            continue
        day = detect_day(tokens[0])
        if not day or day in ("Saturday", "Sunday"):
            continue

        slot_idx = 0
        i        = 1
        while i < len(tokens) and slot_idx < len(TIME_SLOTS):
            t  = tokens[i].strip()
            tl = t.lower()
            if tl in {"break", "lunch", "recess", "|", "_", "—", "-", "b", "r", "e", "a", "k"}:
                i += 1
                continue
            if len(t) < 2 or tl in SKIP_WORDS:
                i += 1
                continue
            t = OCR_CORRECTIONS.get(t, t)
            if not t or len(t) < 2:
                i += 1
                slot_idx += 1
                continue
            lab = is_lab_entry(t)
            entries.append({
                "day":         day,
                "time":        TIME_SLOTS[slot_idx],
                "subject":     t.upper().strip(" .-—_|/\\"),
                "facultyName": "—",
                "isLab":       lab,
                "span":        2 if lab else 1,
                "confidence":  40,
            })
            slot_idx += 1
            i        += 1
    return entries


# ══════════════════════════════════════════════════════════════════════════════
# MULTI-STRATEGY RUNNER  (FIX 14, 19)
# ══════════════════════════════════════════════════════════════════════════════

def _quality_score(entries: list) -> float:
    """FIX 19: score = entries × mean subject length. Penalises short garbage."""
    if not entries:
        return 0.0
    mean_len = sum(len(e["subject"]) for e in entries) / len(entries)
    return len(entries) * mean_len


def run_all_strategies(images: list) -> tuple:
    report   = {}
    raw_text = ""
    img      = images[0]

    # Strategy 1: Spatial TSV parser (best for clean printed tables)
    s1 = []
    try:
        parser   = TimetableParser()
        s1       = parser.parse(img)
        raw_text = parser.raw_text
        report["spatial_tsv"] = {"entries": len(s1), "quality": round(_quality_score(s1), 1)}
    except Exception as ex:
        report["spatial_tsv"] = {"entries": 0, "error": str(ex)}

    # Strategy 2: Raw text positional
    s2 = []
    try:
        if not raw_text:
            raw_text = pytesseract.image_to_string(
                get_preprocessors()[0](img), config="--psm 6 --oem 3"
            )
        s2 = parse_raw_text_lines(raw_text)
        report["raw_text"] = {"entries": len(s2), "quality": round(_quality_score(s2), 1)}
    except Exception as ex:
        report["raw_text"] = {"entries": 0, "error": str(ex)}

    # Strategy 3: Multi-PSM sweep
    s3 = []
    try:
        preprocs = get_preprocessors()
        proc_img = preprocs[1](img) if len(preprocs) > 1 else preprocs[0](img)
        for psm in [4, 6, 11, 12]:
            try:
                raw_alt = pytesseract.image_to_string(proc_img, config=f"--psm {psm} --oem 3")
                cands   = parse_raw_text_lines(raw_alt)
                if _quality_score(cands) > _quality_score(s3):
                    s3 = cands
            except Exception:
                continue
        report["multi_psm"] = {"entries": len(s3), "quality": round(_quality_score(s3), 1)}
    except Exception as ex:
        report["multi_psm"] = {"entries": 0, "error": str(ex)}

    # FIX 14: merge multi-page results (each page = one section or same section different days)
    if len(images) > 1:
        all_entries = list(s1)
        existing_keys = {(e["day"], e["time"]) for e in s1}
        for page_img in images[1:]:
            try:
                sub_parser = TimetableParser()
                sub_entries = sub_parser.parse(page_img)
                for e in sub_entries:
                    if (e["day"], e["time"]) not in existing_keys:
                        all_entries.append(e)
                        existing_keys.add((e["day"], e["time"]))
            except Exception:
                continue
        if len(all_entries) > len(s1):
            s1 = all_entries
            report["multi_page"] = {"pages": len(images), "merged_entries": len(s1)}

    # FIX 19: pick winner by quality score, not just count
    candidates   = [(s1, "spatial_tsv"), (s2, "raw_text"), (s3, "multi_psm")]
    # Prefer s1 if it's within 50% of the best quality
    best_quality = max(_quality_score(s) for s, _ in candidates)
    s1_quality   = _quality_score(s1)
    if s1_quality >= best_quality * 0.5 and len(s1) >= 3:
        best, winner = s1, "spatial_tsv"
    else:
        best, winner = max(candidates, key=lambda x: _quality_score(x[0]))

    report["winner"]         = winner
    report["winner_entries"] = len(best)
    report["winner_quality"] = round(_quality_score(best), 1)

    return best, raw_text, report


# ══════════════════════════════════════════════════════════════════════════════
# POST-PROCESSING  (FIX 15, 16, 20)
# ══════════════════════════════════════════════════════════════════════════════

def dedup(entries: list) -> list:
    """
    FIX 15: prefer real faculty > longer subject > first seen.
    FIX 16: lab entries — collapse consecutive same-subject into single span-2.
    FIX 20: normalise subjects to UPPER.
    """
    # Normalise subjects
    for e in entries:
        e["subject"] = e["subject"].upper().strip()

    seen = {}
    for e in entries:
        k = (e["day"], e["time"])
        if k not in seen:
            seen[k] = e
        else:
            cur = seen[k]
            cur_has_fac  = cur["facultyName"] not in ("—", "", None)
            new_has_fac  = e["facultyName"] not in ("—", "", None)
            cur_len      = len(cur["subject"])
            new_len      = len(e["subject"])
            if (not cur_has_fac and new_has_fac) or \
               (cur_has_fac == new_has_fac and new_len > cur_len):
                seen[k] = e

    result = list(seen.values())

    # FIX 16: collapse lab duplicates (same day+subject in adjacent slots)
    result.sort(key=lambda e: (e["day"], TIME_SLOTS.index(e["time"])
                                if e["time"] in TIME_SLOTS else 99))
    collapsed = []
    skip_next = False
    for i, e in enumerate(result):
        if skip_next:
            skip_next = False
            continue
        if (e["isLab"] and i + 1 < len(result)):
            nxt = result[i + 1]
            if (nxt["day"] == e["day"] and
                nxt["subject"] == e["subject"] and
                nxt["isLab"]):
                # same lab in consecutive slots → keep one with span=2
                merged = dict(e)
                merged["span"] = 2
                collapsed.append(merged)
                skip_next = True
                continue
        collapsed.append(e)

    return collapsed


def header_hints(raw: str) -> dict:
    hints = {"semester": "", "classroom": "", "wef": "", "section": "", "department": ""}
    for line in raw.splitlines():
        l = line.strip()
        if not hints["semester"] and re.search(r"sem(ester)?\s*[\dIVX]+", l, re.I):
            hints["semester"] = l
        if not hints["classroom"] and re.search(r"\broom\b|\bhall\b|\bclass.?room\b", l, re.I):
            m = re.search(r"(?:room|hall)[:\s#]*(\w+)", l, re.I)
            hints["classroom"] = m.group(0) if m else l
        if not hints["wef"] and re.search(r"w\.?e\.?f|effect\s*from", l, re.I):
            m = re.search(r"\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}", l)
            if m:
                hints["wef"] = m.group(0)
        if not hints["section"] and re.search(r"\bsec(tion)?\b|\bcluster\b", l, re.I):
            hints["section"] = l
        if not hints["department"] and re.search(r"\bdept\b|\bdepartment\b", l, re.I):
            hints["department"] = l
    return hints


# ══════════════════════════════════════════════════════════════════════════════
# DOCX EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

def extract_from_docx(raw_bytes: bytes) -> tuple:
    if not DOCX_AVAILABLE:
        raise ValidationError("python-docx not installed. Run: pip install python-docx", 503)
    doc      = DocxDocument(io.BytesIO(raw_bytes))
    raw_text = "\n".join(p.text for p in doc.paragraphs)
    entries  = []
    time_re  = re.compile(r"\d{1,2}[:\.]\d{2}")

    for table in doc.tables:
        if len(table.rows) < 2 or len(table.columns) < 3:
            continue
        header_row = None
        for row in table.rows:
            texts = [c.text.strip() for c in row.cells]
            if sum(1 for t in texts if time_re.search(t)) >= 2:
                header_row = texts
                break
        if not header_row:
            continue
        col_times = []
        for ct in header_row:
            m = time_re.search(ct)
            if m:
                mins = _parse_time_minutes(m.group(0))
                col_times.append(_minutes_to_slot(mins) if mins else None)
            else:
                col_times.append(None)
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            raw_d = re.sub(r"[^a-z]", "", cells[0].strip().lower())
            day   = None
            for alias, d in DAY_ALIASES.items():
                if raw_d.startswith(alias):
                    day = d
                    break
            if not day:
                continue
            for ci, ct in enumerate(cells[1:], 1):
                if ci >= len(col_times) or not col_times[ci]:
                    continue
                if not ct or ct.lower() in SKIP_WORDS:
                    continue
                ct = OCR_CORRECTIONS.get(ct.strip().upper(), ct.strip().upper())
                lab     = is_lab_entry(ct)
                subject = parse_lab_name(ct) if lab else ct.upper().strip()
                entries.append({
                    "day": day, "time": col_times[ci],
                    "subject": subject, "facultyName": "—",
                    "isLab": lab, "span": 2 if lab else 1, "confidence": 90,
                })
    return entries, raw_text



def extract_from_xlsx(raw_bytes: bytes) -> tuple:
    """
    Read timetable from Excel (.xlsx/.xls) file using openpyxl.
    Supports two layouts:
      Layout A — standard: Day col on left, time slots as column headers in row 1/2
      Layout B — transposed: days as columns, times as rows (uncommon)
    Returns (entries, raw_text) same as extract_from_docx.
    """
    if not XLSX_AVAILABLE:
        raise ValidationError("openpyxl not installed. Run: pip install openpyxl", 503)

    wb  = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
    all_entries = []
    raw_lines   = []

    for ws in wb.worksheets:
        rows = []
        for row in ws.iter_rows(values_only=True):
            # Convert all cells to stripped strings, replace None with ""
            rows.append([str(c).strip() if c is not None else "" for c in row])

        if not rows:
            continue

        raw_lines.extend(" | ".join(r) for r in rows[:5])

        time_re = re.compile(r"\d{1,2}[:\.]\d{2}")

        # ── Find header row (contains at least 2 time tokens) ──
        header_idx = None
        col_times  = []
        for ri, row in enumerate(rows[:20]):
            time_count = sum(1 for c in row if time_re.search(c))
            if time_count >= 2:
                header_idx = ri
                for c in row:
                    m = time_re.search(c)
                    if m:
                        mins = _parse_time_minutes(m.group(0))
                        col_times.append(_minutes_to_slot(mins) if mins else None)
                    else:
                        col_times.append(None)
                break

        if header_idx is None or not any(col_times):
            # Fallback: positional — assign slots by column index
            for row in rows:
                if not row:
                    continue
                day = None
                for c in row[:3]:
                    day = detect_day(c)
                    if day:
                        break
                if not day or day in ("Saturday", "Sunday"):
                    continue
                slot_idx = 0
                for c in row[1:]:
                    if slot_idx >= len(TIME_SLOTS):
                        break
                    ct = clean_text(c)
                    if not ct or is_noise(ct) or re.search(r"break|lunch|recess", ct, re.I):
                        continue
                    ct = OCR_CORRECTIONS.get(ct.upper(), ct.upper())
                    lab = is_lab_entry(ct)
                    all_entries.append({
                        "day": day, "time": TIME_SLOTS[slot_idx],
                        "subject": parse_lab_name(ct) if lab else ct,
                        "facultyName": "\u2014", "isLab": lab,
                        "span": 2 if lab else 1, "confidence": 70,
                    })
                    slot_idx += 1
            continue

        # ── Parse data rows below header ──
        # Also scan for a faculty mapping section (subject / faculty columns)
        fac_map_local = {}
        in_fac_section = False

        for row in rows[header_idx + 1:]:
            row_text = " ".join(row)

            # Detect faculty table header
            if re.search(r"sub[ij]ect|subiect", row_text, re.I) and re.search(r"faculty|code", row_text, re.I):
                in_fac_section = True
                continue

            # Parse faculty mapping rows
            if in_fac_section:
                if re.search(r"timetable|principal|hod|dean|signature", row_text, re.I):
                    in_fac_section = False
                    continue
                # Try to extract abbr + faculty from this row
                abbr_m = re.search(r"\(([A-Z]{2,12})\)", row_text)
                abbr   = abbr_m.group(1) if abbr_m else None
                if not abbr:
                    code_m = re.search(r"\b([A-Z]{2,4}\d{3}[A-Z]?)\b", row_text)
                    abbr   = code_m.group(1) if code_m else None
                fac = extract_faculty_name(row_text)
                if abbr and fac:
                    fac_map_local[abbr] = fac
                continue

            # Normal timetable row — detect day
            day = None
            for c in row[:3]:
                day = detect_day(c)
                if day:
                    break
            if not day or day in ("Saturday", "Sunday"):
                continue

            # Map cells to slots
            for ci, c in enumerate(row):
                if ci >= len(col_times) or not col_times[ci]:
                    continue
                ct = clean_text(c)
                if not ct or is_noise(ct):
                    continue
                if re.search(r"\b(break|lunch|recess)\b", ct, re.I):
                    continue
                if detect_day(ct):
                    continue
                ct  = OCR_CORRECTIONS.get(ct.upper(), ct.upper())
                lab = is_lab_entry(ct)
                subj = parse_lab_name(ct) if lab else ct
                all_entries.append({
                    "day": day, "time": col_times[ci],
                    "subject": subj, "facultyName": "\u2014",
                    "isLab": lab, "span": 2 if lab else 1, "confidence": 92,
                })

        # Backfill faculty from local map
        for entry in all_entries:
            if entry["facultyName"] != "\u2014":
                continue
            subj = entry["subject"].upper()
            if subj in fac_map_local:
                entry["facultyName"] = fac_map_local[subj]
            else:
                for abbr, fac in fac_map_local.items():
                    if subj.startswith(abbr) or abbr.startswith(subj[:3]):
                        entry["facultyName"] = fac
                        break

    raw_text = "\n".join(raw_lines)
    return all_entries, raw_text


def extract_text_from_pdf(raw_bytes: bytes) -> str:
    """
    Extract raw text from a text-based PDF using pdfplumber.
    Returns empty string if pdfplumber unavailable or PDF is image-only.
    """
    if not PDFPLUMBER_AVAILABLE:
        return ""
    try:
        import pdfplumber
        texts = []
        with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    texts.append(t.strip())
        return "\n".join(texts)
    except Exception:
        return ""


def parse_course_list_pdf(raw_text: str) -> tuple:
    """
    Parse a course-list PDF in the format:
        Semester: 4
        Cluster: 4
        Section: CSE-12
        Course Code  Subject  Credit  Faculty Name
        BCS401       ADA      4       Dr Harish Kumar N
        BCS403       DBMS     4       Prof Annapareddy
        BCS411       ADA LAB  2       Dr Harish Kumar N
        ...

    Returns:
        (subjects, faculty_map, meta)
        subjects   = [{ subject_name, subject_code, hours_per_week, subject_type }, ...]
        faculty_map= { subject_code: faculty_name, ... }
        meta       = { semester, cluster, section }
    """
    subjects    = []
    faculty_map = {}
    meta        = {"semester": "", "cluster": "", "section": ""}

    lines = raw_text.splitlines()

    # Extract header meta
    for line in lines[:10]:
        l = line.strip()
        m = re.match(r"semester[:\s]+([\d]+)", l, re.I)
        if m: meta["semester"] = m.group(1)
        m = re.match(r"cluster[:\s]+([\d]+)", l, re.I)
        if m: meta["cluster"] = m.group(1)
        m = re.match(r"section[:\s]+([\w\-]+)", l, re.I)
        if m: meta["section"] = m.group(1)

    # Find data rows: lines with a course code pattern (BCS401, BCS456F, etc.)
    code_re = re.compile(r"^([A-Z]{2,5}\d{3}[A-Z]?(?:/[A-Z]{2,5}\d{3}[A-Z]?)?)", re.I)

    for line in lines:
        line = line.strip()
        m = code_re.match(line)
        if not m:
            continue

        code    = m.group(1).strip().upper()
        rest    = line[len(code):].strip()

        # Extract credit (a standalone 1-2 digit number)
        credit_m = re.search(r"\b([1-9])\b", rest)
        credit   = int(credit_m.group(1)) if credit_m else 3

        # Split rest into subject name + faculty
        # Strategy: faculty name starts with Dr/Prof/Mr/Ms/Mrs or Title Case word
        fac_re  = re.compile(
            r"(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Er\.?|Smt\.?)\s+[A-Z]", re.I
        )
        fac_m   = fac_re.search(rest)

        if fac_m:
            subj_raw = rest[:fac_m.start()].strip()
            fac_raw  = rest[fac_m.start():].strip()
            # Remove credit from subject
            subj_raw = re.sub(r"\b[1-9]\b", "", subj_raw).strip()
        else:
            # No titled faculty — split on last 2+ uppercase words as faculty
            tokens   = rest.split()
            # Find where faculty starts: last sequence of Title-Case words
            fac_start = len(tokens)
            for ti in range(len(tokens)-1, -1, -1):
                if re.match(r"^[A-Z][a-z]+$|^[A-Z]+\.$", tokens[ti]):
                    fac_start = ti
                else:
                    break
            subj_raw = " ".join(tokens[:fac_start]).strip()
            fac_raw  = " ".join(tokens[fac_start:]).strip()
            subj_raw = re.sub(r"\b[1-9]\b", "", subj_raw).strip()

        # Clean subject name
        subj_name = subj_raw.upper().strip(" .-_")
        if not subj_name or len(subj_name) < 2:
            continue

        # Detect lab
        is_lab = bool(re.search(r"\blab\b|-L\b|PRACTICAL", subj_name, re.I))
        if is_lab:
            subj_name = parse_lab_name(subj_name) + " LAB"

        # Apply corrections
        base = subj_name.replace(" LAB", "").strip()
        base = OCR_CORRECTIONS.get(base, base)
        if is_lab:
            subj_name = base + " LAB"
        else:
            subj_name = base

        subjects.append({
            "subject_name":   subj_name,
            "subject_code":   code,
            "hours_per_week": credit,
            "subject_type":   "LAB" if is_lab else "THEORY",
        })

        if fac_raw and len(fac_raw) > 3:
            # Clean faculty name
            fac_clean = fac_raw.strip(" .,;")
            faculty_map[code]      = fac_clean
            faculty_map[subj_name] = fac_clean

    return subjects, faculty_map, meta


def is_course_list_pdf(raw_text: str) -> bool:
    """
    Detect if a PDF is a course-list (subject+faculty list) rather than
    a timetable grid. Returns True if it looks like a course list.
    """
    if not raw_text:
        return False
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    # Must have at least 2 lines with course code pattern
    code_re = re.compile(r"^[A-Z]{2,5}\d{3}[A-Z]?", re.I)
    code_lines = sum(1 for l in lines if code_re.match(l))
    # Must NOT have time-slot pattern (no timetable)
    time_re = re.compile(r"\b\d{1,2}[.:]\d{2}\b")
    time_lines = sum(1 for l in lines if time_re.search(l))
    # Must NOT have day names in first column
    day_lines = sum(1 for l in lines if detect_day(l.split()[0]) if l.split())
    return code_lines >= 2 and time_lines == 0 and day_lines == 0

# ══════════════════════════════════════════════════════════════════════════════
# FASTAPI ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
def ocr_status():
    try:
        tess_path = pytesseract.pytesseract.tesseract_cmd if OCR_AVAILABLE else "not found"
    except Exception:
        tess_path = "not found"
    return {
        "ocr_ready":            OCR_AVAILABLE,
        "pdf_ready":            PDF_AVAILABLE,
        "docx_ready":           DOCX_AVAILABLE,
        "xlsx_ready":           XLSX_AVAILABLE,
        "opencv_available":     CV2_AVAILABLE,
        "numpy_available":      NUMPY_AVAILABLE,
        "pillow_available":     PIL_AVAILABLE,
        "tesseract_path":       tess_path,
        "missing_dependencies": _MISSING,
        "install_command":      "pip install pytesseract Pillow opencv-python-headless numpy pdf2image python-docx",
        "tesseract_install":    "https://github.com/UB-Mannheim/tesseract/wiki",
        "supported_formats":    ["JPEG","PNG","BMP","TIFF","WEBP","PDF","DOCX","XLSX","XLS"],
        "max_file_size_mb":     MAX_FILE_SIZE_MB,
        "engine_version":       "v4.1",
        "message":              "All systems ready" if OCR_AVAILABLE else
                                f"NOT READY - missing: {'; '.join(_MISSING[:2]) if _MISSING else 'unknown'}",
    }

@router.post("/upload-generate")
async def upload_and_generate(file: UploadFile = File(...)):
    if not OCR_AVAILABLE:
        raise HTTPException(status_code=503, detail={
            "error": "Tesseract OCR engine not available.",
            "fix":   "Install from https://github.com/UB-Mannheim/tesseract/wiki",
        })

    filename     = (file.filename or "untitled").strip()
    content_type = (file.content_type or "").lower()
    raw_bytes    = await file.read()

    try:
        file_info = validate_file(filename, content_type, raw_bytes)
    except ValidationError as e:
        raise HTTPException(status_code=e.code, detail=e.message)

    file_type    = file_info["file_type"]
    all_warnings = []

    # ── XLSX ──
    if file_type == "xlsx":
        try:
            entries, raw_text = extract_from_xlsx(raw_bytes)
        except ValidationError as e:
            raise HTTPException(status_code=e.code, detail=e.message)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Excel parse failed: {e}")
        entries = dedup(entries)
        quality = "good" if len(entries) >= 10 else "fair" if len(entries) >= 4 else "poor"
        hints   = header_hints(raw_text)
        warnings = []
        if quality == "poor":
            warnings.append(
                f"Only {len(entries)} entries found. "
                "Make sure your Excel file has a timetable table with time headers and day column. "
                "Tip: the first row (or second row) must contain time slots like 8:30-9:25."
            )
        return JSONResponse({
            "success": len(entries) > 0, "source": "xlsx_direct",
            "entries_found": len(entries), "quality": quality,
            "raw_text": raw_text[:3000], "header": hints,
            "warnings": warnings,
            "timetable": entries, "timetable_data": entries,
            "strategy_report": {"winner": "xlsx_table"},
        })

    # ── DOCX ──
    if file_type == "docx":
        try:
            entries, raw_text = extract_from_docx(raw_bytes)
        except ValidationError as e:
            raise HTTPException(status_code=e.code, detail=e.message)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Word parse failed: {e}")
        entries = dedup(entries)
        return JSONResponse({
            "success": True, "source": "docx_direct", "entries_found": len(entries),
            "raw_text": raw_text[:3000], "header": header_hints(raw_text),
            "warnings": [], "quality": "good" if len(entries) >= 5 else "fair",
            "timetable": entries, "timetable_data": entries,
            "strategy_report": {"winner": "docx_table"},
        })

    # ── PDF ──
    if file_type == "pdf":
        # STEP 1: Try text extraction first (no poppler needed)
        pdf_text = extract_text_from_pdf(raw_bytes)

        # STEP 2: Check if it is a course-list PDF (subject+faculty list)
        if pdf_text and is_course_list_pdf(pdf_text):
            try:
                subjects, faculty_map, meta = parse_course_list_pdf(pdf_text)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Course list parse failed: {e}")

            if not subjects:
                raise HTTPException(status_code=422, detail=(
                    "PDF appears to be a course list but no subjects could be extracted. "
                    "Make sure each row has: Course Code  Subject Name  Credits  Faculty Name"
                ))

            return JSONResponse({
                "success":        True,
                "source":         "pdf_course_list",
                "type":           "course_list",
                "entries_found":  len(subjects),
                "quality":        "good",
                "raw_text":       pdf_text[:3000],
                "header":         meta,
                "warnings":       [
                    "This is a course list, not a timetable. "
                    "Subjects and faculty have been extracted. "
                    "Use this data to populate your Subjects and Faculty pages."
                ],
                "subjects":       subjects,
                "faculty_map":    faculty_map,
                "timetable":      [],
                "timetable_data": [],
                "strategy_report": {"winner": "pdf_course_list"},
            })

        # STEP 3: Check if it is a text-based timetable PDF
        if pdf_text:
            entries = parse_raw_text_lines(pdf_text)
            if len(entries) >= 3:
                entries = dedup(entries)
                return JSONResponse({
                    "success":         True,
                    "source":          "pdf_text",
                    "entries_found":   len(entries),
                    "quality":         "good" if len(entries) >= 10 else "fair",
                    "raw_text":        pdf_text[:3000],
                    "header":          header_hints(pdf_text),
                    "warnings":        [],
                    "timetable":       entries,
                    "timetable_data":  entries,
                    "strategy_report": {"winner": "pdf_text_direct"},
                })

        # STEP 4: Fall back to image OCR (needs poppler)
        if not PDF_AVAILABLE:
            raise HTTPException(status_code=503, detail=(
                "This PDF appears to be image-based (scanned). "
                "To process it, install poppler: "
                "Windows: https://github.com/oschwartz10612/poppler-windows/releases — "
                "download, extract to C:\\poppler, add C:\\poppler\\Library\\bin to PATH. "
                "Then restart backend."
            ))
        try:
            images = convert_from_bytes(raw_bytes, dpi=250, fmt="png")
        except Exception as e:
            raise HTTPException(status_code=422, detail=(
                f"PDF conversion failed: {e}. "
                "Poppler may not be in PATH. "
                "Windows install: https://github.com/oschwartz10612/poppler-windows/releases"
            ))
        if len(images) > MAX_PDF_PAGES:
            all_warnings.append(f"PDF has {len(images)} pages — only first {MAX_PDF_PAGES} processed.")
            images = images[:MAX_PDF_PAGES]
        try:
            dim_info = validate_image_dimensions(images[0])
            all_warnings.extend(dim_info.get("warnings", []))
        except ValidationError as e:
            raise HTTPException(status_code=e.code, detail=e.message)

    # ── IMAGE ──
    else:
        try:
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode in ("RGBA", "P", "LA"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Cannot open image: {e}")
        try:
            dim_info = validate_image_dimensions(img)
            all_warnings.extend(dim_info.get("warnings", []))
            file_info.update(dim_info)
        except ValidationError as e:
            raise HTTPException(status_code=e.code, detail=e.message)
        images = [img]

    # ── OCR ──
    try:
        entries, raw_text, strategy_report = run_all_strategies(images)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")

    entries = dedup(entries)
    hints   = header_hints(raw_text)
    quality = "good" if len(entries) >= 10 else "fair" if len(entries) >= 4 else "poor"

    if quality == "poor":
        all_warnings.append(
            f"Only {len(entries)} entries detected. "
            "For best results: use a >=200 DPI scan, landscape orientation, "
            "full table with time headers visible, no shadows or folds."
        )
    elif quality == "fair":
        all_warnings.append(
            "Partial extraction. Review the timetable and fill in any missing slots manually."
        )

    return JSONResponse({
        "success":         len(entries) > 0,
        "source":          file_type,
        "entries_found":   len(entries),
        "quality":         quality,
        "raw_text":        raw_text[:3000],
        "header":          hints,
        "file_info":       file_info,
        "warnings":        all_warnings,
        "strategy_report": strategy_report,
        "timetable":       entries,
        "timetable_data":  entries,
        "mapping":         [],
    })


@router.post("/upload")
async def upload_alias(file: UploadFile = File(...)):
    """Alias endpoint — supports both /upload and /upload-generate."""
    return await upload_and_generate(file)

upload_alias

@router.post("/extract-table")
async def extract_table(
    file: UploadFile = File(...),
    target: str = Query("faculty", description="Target: faculty, subjects, rooms, sections, labs")
):
    """
    Extract tabular data (faculty/subjects/rooms/sections) from Excel/PDF/Image.
    This is different from upload-generate which extracts timetables.
    """
    filename = (file.filename or "untitled").strip()
    content_type = (file.content_type or "").lower()
    raw_bytes = await file.read()

    try:
        file_info = validate_file(filename, content_type, raw_bytes)
    except ValidationError as e:
        raise HTTPException(status_code=e.code, detail=e.message)

    file_type = file_info["file_type"]

    # Handle XLSX files
    if file_type == "xlsx":
        try:
            import openpyxl
            import io
            
            wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
            ws = wb.active
            
            # Convert worksheet to list of lists
            all_rows = list(ws.iter_rows(values_only=True))
            
            if len(all_rows) < 2:
                raise HTTPException(status_code=422, detail="Excel file must have at least 2 rows (header + data)")
            
            # First row = headers
            headers = []
            for cell in all_rows[0]:
                if cell is not None:
                    headers.append(str(cell).strip())
                else:
                    headers.append("")
            
            # Remove empty trailing headers
            while headers and not headers[-1]:
                headers.pop()
            
            if not headers:
                raise HTTPException(status_code=422, detail="No column headers found in first row")
            
            # Remaining rows = data
            records = []
            for row_values in all_rows[1:]:  # Skip first row (headers)
                # Skip completely empty rows
                if not any(cell is not None and str(cell).strip() for cell in row_values):
                    continue
                
                record = {}
                for i, value in enumerate(row_values):
                    if i < len(headers) and headers[i]:
                        # Convert value to string, handle None
                        if value is None:
                            record[headers[i]] = ""
                        else:
                            record[headers[i]] = str(value).strip()
                
                # Only add record if it has at least one non-empty value
                if any(v for v in record.values()):
                    records.append(record)
            
            wb.close()
            
            return JSONResponse({
                "success": len(records) > 0,
                "source": "xlsx_direct",
                "records": records,
                "entries_found": len(records),
                "quality": "good" if len(records) >= 5 else "fair" if len(records) >= 1 else "poor",
                "headers": headers,  # Include headers for debugging
                "raw_text": f"Extracted {len(records)} records from {len(headers)} columns",
            })
            
        except Exception as e:
            import traceback
            raise HTTPException(
                status_code=500, 
                detail=f"Excel parse failed: {str(e)}\n{traceback.format_exc()}"
            )