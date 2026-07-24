import tempfile
import unittest
from pathlib import Path

import yaml

from generate_templates import (
    TemplateGenerator,
    resolve_contained_path,
    validate_template_name,
)


class TemplatePathSecurityTests(unittest.TestCase):
    @staticmethod
    def create_workspace(root: Path) -> None:
        for name in ("reference", "definitions", "build", "originals"):
            (root / name).mkdir()

    def test_template_names_are_single_safe_path_segments(self) -> None:
        self.assertEqual(validate_template_name("vite-react_cf"), "vite-react_cf")
        for value in ("../outside", "nested/template", "/absolute", ".", ""):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_template_name(value)

    def test_resolved_paths_cannot_escape_or_follow_symlinks_outside_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temp_root = Path(directory)
            allowed_root = temp_root / "allowed"
            outside_root = temp_root / "outside"
            allowed_root.mkdir()
            outside_root.mkdir()
            (allowed_root / "escape").symlink_to(outside_root, target_is_directory=True)

            self.assertEqual(
                resolve_contained_path(
                    allowed_root, "nested/file.txt", "test path"
                ),
                allowed_root.resolve() / "nested/file.txt",
            )
            for value in ("../outside/file.txt", "/tmp/file.txt", "escape/file.txt"):
                with self.subTest(value=value):
                    with self.assertRaises(ValueError):
                        resolve_contained_path(allowed_root, value, "test path")

    def test_malicious_yaml_name_cannot_delete_outside_build(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "reference").mkdir()
            (root / "definitions").mkdir()
            (root / "build").mkdir()
            outside = root / "outside"
            outside.mkdir()
            sentinel = outside / "sentinel.txt"
            sentinel.write_text("preserve", encoding="utf-8")
            definition = root / "definitions" / "malicious.yaml"
            definition.write_text(
                yaml.safe_dump(
                    {
                        "name": "../../outside",
                        "base_reference": "vite-reference",
                    }
                ),
                encoding="utf-8",
            )

            generator = TemplateGenerator(root, trusted_root=root)
            self.assertFalse(generator.generate_template_from_yaml(definition))
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "preserve")

    def test_overlay_and_patch_paths_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template_dir = root / "definitions" / "safe-template"
            target_dir = root / "build" / "safe-template"
            template_dir.mkdir(parents=True)
            target_dir.mkdir(parents=True)
            (root / "reference").mkdir()
            (root / "originals").mkdir()
            outside = root / "outside.txt"
            outside.write_text("preserve", encoding="utf-8")
            generator = TemplateGenerator(root, trusted_root=root)

            self.assertFalse(
                generator.apply_template_specific_files(
                    "safe-template",
                    target_dir,
                    ["../../outside.txt"],
                )
            )
            self.assertFalse(
                generator.apply_file_patches(
                    target_dir,
                    [{"file": "../../outside.txt", "replacements": []}],
                )
            )
            self.assertEqual(outside.read_text(encoding="utf-8"), "preserve")

    def test_symlinked_workspace_directories_are_rejected_before_generation(
        self,
    ) -> None:
        for linked_name in ("reference", "build"):
            with self.subTest(linked_name=linked_name):
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory) / "templates"
                    outside = Path(directory) / "outside"
                    root.mkdir()
                    outside.mkdir()
                    sentinel = outside / "sentinel.txt"
                    sentinel.write_text("preserve", encoding="utf-8")

                    for name in ("reference", "definitions", "build", "originals"):
                        if name == linked_name:
                            (root / name).symlink_to(
                                outside,
                                target_is_directory=True,
                            )
                        else:
                            (root / name).mkdir()

                    with self.assertRaisesRegex(
                        ValueError,
                        "real non-symlink directory",
                    ):
                        TemplateGenerator(root, trusted_root=root)
                    self.assertEqual(
                        sentinel.read_text(encoding="utf-8"),
                        "preserve",
                    )

    def test_symlinked_generation_source_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.create_workspace(root)
            reference = root / "reference" / "vite-reference"
            public = reference / "public"
            public.mkdir(parents=True)
            (reference / ".env").write_text("do not copy", encoding="utf-8")
            (public / "config").symlink_to(Path("..") / ".env")

            with self.assertRaisesRegex(ValueError, "symbolic links"):
                TemplateGenerator(root, trusted_root=root)


if __name__ == "__main__":
    unittest.main()
