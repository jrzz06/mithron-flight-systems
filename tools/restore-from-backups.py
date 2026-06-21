#!/usr/bin/env python3
"""Restore enhanced source masters from .bak backups and remove corrupted artifacts."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC = PROJECT_ROOT / "public"
OPTIMIZED = PUBLIC / "optimized"
STAGING = PROJECT_ROOT / "tools" / ".enhance-supabase-staging"
MARKER_SUFFIX = ".enhanced.json"

OPTIMIZED_BUCKETS = [
    "hero-slides",
    "shelf-heroes",
    "agrone-mission",
    "catalog-showcases",
    "storefront",
]


def restore_from_backup(source_path: Path) -> bool:
    backup = source_path.with_suffix(source_path.suffix + ".bak")
    if not backup.exists():
        return False
    shutil.copy2(backup, source_path)
    marker = source_path.with_suffix(source_path.suffix + MARKER_SUFFIX)
    if marker.exists():
        marker.unlink()
    return True


def main() -> int:
    manifest_path = PROJECT_ROOT / "tools" / ".enhance-visible-manifest.json"
    restored = 0
    missing_backup = []

    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for item in manifest.get("items", []):
            resolved = item.get("resolvedPath")
            if not resolved:
                continue
            path = Path(resolved)
            if restore_from_backup(path):
                restored += 1
                print(f"restored {item.get('src')}")
            else:
                missing_backup.append(str(item.get("src")))

    for marker in PUBLIC.rglob(f"*{MARKER_SUFFIX}"):
        marker.unlink()
        print(f"removed marker {marker.relative_to(PROJECT_ROOT)}")

    for bucket in OPTIMIZED_BUCKETS:
        bucket_dir = OPTIMIZED / bucket
        if not bucket_dir.exists():
            continue
        for entry in bucket_dir.iterdir():
            if entry.is_dir():
                shutil.rmtree(entry)
                print(f"removed optimized dir {entry.relative_to(PROJECT_ROOT)}")

    if STAGING.exists():
        shutil.rmtree(STAGING)
        print(f"removed staging {STAGING.relative_to(PROJECT_ROOT)}")

    for results in (PROJECT_ROOT / "tools").glob(".enhance-*.results.json"):
        results.unlink()
        print(f"removed {results.name}")

    print(json.dumps({"restored": restored, "missingBackup": missing_backup}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
