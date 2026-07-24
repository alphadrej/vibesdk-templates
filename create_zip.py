#!/usr/bin/env python3
"""
Create a zip archive from a directory, compatible with unzip command.
This script replaces the zip command for environments where it's not available.
"""

import zipfile
import os
import sys
import fnmatch
from pathlib import Path

DEFAULT_EXCLUDE_PATTERNS = [
    "node_modules/*",
    ".git/*",
    "*.log",
    ".DS_Store",
    "dist/*",
    "build/*",
    ".next/*",
    "coverage/*",
    ".nyc_output/*",
    "*.tgz",
    "*.tar.gz",
    ".wrangler/*",
    ".ssh/*",
    ".aws/*",
    ".dev.vars",
    ".dev.vars.*",
    ".env",
    ".env.*",
    ".envrc",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_xmss",
    ".netrc",
    ".npmrc",
    ".pypirc",
    ".yarnrc",
    "credentials.json",
    "*credentials*.json",
    "secret.json",
    "secrets.json",
]


def create_zip(source_dir, zip_path, exclude_patterns=None):
    """
    Create a zip file from a directory with exclusion patterns.
    
    Args:
        source_dir: Path to the source directory
        zip_path: Path where the zip file will be created
        exclude_patterns: List of patterns to exclude (e.g., ["node_modules/*", ".git/*"])
    """
    if exclude_patterns is None:
        exclude_patterns = DEFAULT_EXCLUDE_PATTERNS

    source_input = Path(source_dir)
    if source_input.is_symlink():
        print(
            f"Error: Source directory must not be a symbolic link: {source_dir}",
            file=sys.stderr,
        )
        return False

    source_path = source_input.resolve()
    if not source_path.exists() or not source_path.is_dir():
        print(f"Error: Source directory '{source_dir}' does not exist", file=sys.stderr)
        return False

    zip_target = Path(zip_path)
    if zip_target.is_symlink():
        print(
            f"Error: Output zip path must not be a symbolic link: {zip_path}",
            file=sys.stderr,
        )
        return False

    try:
        reject_source_symlinks(source_path)
        with zipfile.ZipFile(zip_target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
            for root, dirs, files in os.walk(source_path):
                # Convert to relative path from source directory
                rel_root = Path(root).relative_to(source_path)

                # Filter directories and files based on exclusion patterns
                dirs[:] = [
                    directory
                    for directory in dirs
                    if not should_exclude_logical_and_real_path(
                        rel_root / directory,
                        (Path(root) / directory).resolve(strict=True),
                        source_path,
                        exclude_patterns,
                    )
                ]

                for file in files:
                    file_path = Path(root) / file
                    try:
                        resolved_file = file_path.resolve(strict=True)
                        resolved_file.relative_to(source_path)
                    except ValueError as error:
                        raise ValueError(
                            f"Archive input escapes source directory: {file_path}"
                        ) from error
                    arc_path = rel_root / file if str(rel_root) != '.' else Path(file)
                    if should_exclude_logical_and_real_path(
                        arc_path,
                        resolved_file,
                        source_path,
                        exclude_patterns,
                    ):
                        continue
                    zipf.write(file_path, arc_path)

        return True
    except Exception as e:
        if zip_target.is_file() and not zip_target.is_symlink():
            zip_target.unlink()
        print(f"Error creating zip file: {e}", file=sys.stderr)
        return False


def reject_source_symlinks(source_path):
    """Fail before archiving when any source entry is a symbolic link."""
    for root, dirs, files in os.walk(source_path, followlinks=False):
        root_path = Path(root)
        for name in [*dirs, *files]:
            entry = root_path / name
            if entry.is_symlink():
                raise ValueError(f"Archive source contains symbolic link: {entry}")


def should_exclude_logical_and_real_path(
    logical_path,
    resolved_path,
    source_path,
    exclude_patterns,
):
    """Apply the secret policy to both archive names and canonical sources."""
    real_relative_path = resolved_path.relative_to(source_path)
    return should_exclude(
        logical_path,
        exclude_patterns,
    ) or should_exclude(real_relative_path, exclude_patterns)


def should_exclude(path, exclude_patterns):
    """
    Check if a path should be excluded based on patterns.
    """
    path_str = str(path).replace('\\', '/')
    while path_str.startswith("./"):
        path_str = path_str[2:]
    path_parts = Path(path_str).parts
    file_name = path_parts[-1] if path_parts else ""
    
    for pattern in exclude_patterns:
        if pattern.endswith('/*'):
            dir_pattern = pattern[:-2]
            if dir_pattern in path_parts:
                return True
        elif fnmatch.fnmatch(path_str, pattern) or fnmatch.fnmatch(
            file_name, pattern
        ):
            return True
    
    return False

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 create_zip.py <source_directory> <output_zip_file>", file=sys.stderr)
        sys.exit(1)
    
    source_dir = sys.argv[1]
    zip_file = sys.argv[2]
    
    # Create parent directory if it doesn't exist
    zip_dir = os.path.dirname(zip_file)
    if zip_dir:
        os.makedirs(zip_dir, exist_ok=True)
    
    if create_zip(source_dir, zip_file):
        # Get file size for output
        size = os.path.getsize(zip_file)
        if size < 1024:
            size_str = f"{size}B"
        elif size < 1024 * 1024:
            size_str = f"{size // 1024}K"
        else:
            size_str = f"{size // (1024 * 1024)}M"
        
        print(f"✅ Created {zip_file} ({size_str})")
        sys.exit(0)
    else:
        print(f"❌ Failed to create {zip_file}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
