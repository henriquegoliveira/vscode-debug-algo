"""
Os testes reproduzem exatamente o procedimento manual:
compilar, breakpoint, injetar o script, ler o arquivo gerado
"""

import json
import re
import subprocess
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
TEST_TARGETS_DIR = REPO_ROOT / "tests" / "targets"
SCRIPTS_DIR = REPO_ROOT / "packages" / "extension" / "scripts"
SCHEMA_PATH = (
    REPO_ROOT / "packages" / "extension" / "schemas" / "graph-snapshot.schema.json"
)
EXPECTED_DIR = REPO_ROOT / "tests" / "targets" / "expected"

TIMEOUT_SECONDS = 20


@pytest.fixture(scope="session")
def compiled_targets():
    subprocess.run(
        ["make", "clean"], cwd=TEST_TARGETS_DIR, check=True, capture_output=True
    )
    result = subprocess.run(
        ["make"], cwd=TEST_TARGETS_DIR, check=False, capture_output=True, text=True
    )
    assert (
        result.returncode == 0
    ), f"falha ao compilar test-targets:\n{result.stdout}\n{result.stderr}"
    return TEST_TARGETS_DIR / "bin"


@pytest.fixture(scope="session")
def schema():
    return json.loads(SCHEMA_PATH.read_text())


def breakpoint_line(source_name: str) -> int:
    text = (TEST_TARGETS_DIR / source_name).read_text()
    for i, line in enumerate(text.splitlines(), start=1):
        if "BREAKPOINT" in line:
            return i
    raise ValueError(f"nenhum marcador BREAKPOINT encontrado em {source_name}")


def _parse_snapshot_path(result: subprocess.CompletedProcess) -> Path:
    assert result.returncode == 0, (
        f"o depurador saiu com codigo {result.returncode}:\n"
        f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
    )
    match = re.search(r"^SNAPSHOT_PATH:(\S+)$", result.stdout, re.MULTILINE)
    assert (
        match
    ), f"nao encontrei 'SNAPSHOT_PATH:' na saida do depurador:\n{result.stdout}"
    path = Path(match.group(1))
    assert (
        path.exists()
    ), f"o extrator disse que escreveu em {path}, mas o arquivo nao existe"
    return path


def run_gdb_extraction(binary_name: str, source_name: str) -> dict:
    line = breakpoint_line(source_name)
    cmd = [
        "gdb",
        "--batch",
        "-ex",
        f"break {source_name}:{line}",
        "-ex",
        "run",
        "-ex",
        f"python import sys; sys.path.insert(0, {str(SCRIPTS_DIR)!r})",
        "-ex",
        "python import extractor_gdb",
        "-ex",
        "python p = extractor_gdb.dump_structs(); print('SNAPSHOT_PATH:' + str(p))",
        f"bin/{binary_name}",
    ]
    result = subprocess.run(
        cmd,
        cwd=TEST_TARGETS_DIR,
        check=False,
        capture_output=True,
        text=True,
        timeout=TIMEOUT_SECONDS,
    )
    path = _parse_snapshot_path(result)
    data = json.loads(path.read_text())
    path.unlink()  # nao deixa lixo acumulando em /tmp
    return data


def run_lldb_extraction(binary_name: str, source_name: str) -> dict:
    line = breakpoint_line(source_name)
    cmd = [
        "lldb",
        "-b",
        "-o",
        f"breakpoint set --file {source_name} --line {line}",
        "-o",
        "run",
        "-o",
        f"script import sys; sys.path.insert(0, {str(SCRIPTS_DIR)!r})",
        "-o",
        "script import extractor_lldb",
        "-o",
        "script p = extractor_lldb.dump_structs(); print('SNAPSHOT_PATH:' + str(p))",
        f"bin/{binary_name}",
    ]
    result = subprocess.run(
        cmd,
        cwd=TEST_TARGETS_DIR,
        check=False,
        capture_output=True,
        text=True,
        timeout=TIMEOUT_SECONDS,
    )
    path = _parse_snapshot_path(result)
    data = json.loads(path.read_text())
    path.unlink()
    return data


EXTRACTORS = {
    "gdb": run_gdb_extraction,
    "lldb": run_lldb_extraction,
}


def load_expected(name: str) -> dict:
    return json.loads((EXPECTED_DIR / f"{name}.expected.json").read_text())
