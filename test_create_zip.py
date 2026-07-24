import tempfile
import unittest
import zipfile
from pathlib import Path

from create_zip import create_zip


class CreateZipSecurityTests(unittest.TestCase):
    def test_sensitive_files_are_excluded_at_every_directory_depth(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            nested = source / "nested"
            nested.mkdir(parents=True)

            included = {
                "index.ts": "export {}",
                "nested/config.example.json": "{}",
            }
            excluded = {
                ".env": "root secret",
                "nested/.env.local": "nested secret",
                "nested/.envrc": "shell secret",
                "nested/private.pem": "key material",
                "nested/id_ed25519": "private key material",
                "nested/.ssh/id_rsa": "ssh private key",
                "nested/.aws/credentials": "cloud credentials",
                "nested/service-credentials.json": "{}",
                "nested/.npmrc": "auth token",
            }
            for relative_path, content in {**included, **excluded}.items():
                path = source / relative_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")

            archive = root / "template.zip"
            self.assertTrue(create_zip(source, archive))

            with zipfile.ZipFile(archive) as zip_file:
                names = set(zip_file.namelist())
            self.assertEqual(names, set(included))

    def test_symlinked_file_cannot_read_outside_the_source_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            outside = root / "outside.txt"
            outside.write_text("do not archive", encoding="utf-8")
            (source / "linked.txt").symlink_to(outside)
            archive = root / "template.zip"

            self.assertFalse(create_zip(source, archive))
            self.assertFalse(archive.exists())

    def test_symlinked_public_name_cannot_archive_an_excluded_secret(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            public = source / "public"
            public.mkdir(parents=True)
            (source / ".env").write_text("do not archive", encoding="utf-8")
            (public / "config").symlink_to(Path("..") / ".env")
            archive = root / "template.zip"

            self.assertFalse(create_zip(source, archive))
            self.assertFalse(archive.exists())

    def test_symlinked_output_cannot_truncate_its_target(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            (source / "index.ts").write_text("export {}", encoding="utf-8")
            target = root / "template_catalog.json"
            target.write_text('{"preserve":true}', encoding="utf-8")
            archive = root / "template.zip"
            archive.symlink_to(target)

            self.assertFalse(create_zip(source, archive))
            self.assertEqual(
                target.read_text(encoding="utf-8"),
                '{"preserve":true}',
            )
            self.assertTrue(archive.is_symlink())


if __name__ == "__main__":
    unittest.main()
