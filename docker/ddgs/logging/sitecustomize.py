"""Configure file logging for the unmodified DDGS API CLI process."""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

filename = os.environ.get("DDGS_LOG_FILE")
if filename:
    Path(filename).parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(filename, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler])
