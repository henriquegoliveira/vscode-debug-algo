import argparse
import json
import os
import re
import xml.etree.ElementTree as ElementTree
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

A4 = (8.27, 11.69)
INK = "#0b0b0b"
MUTED = "#52514e"
GRID = "#e4e3df"
FAILURE = "#e34948"
LAYER_COLORS = {
    "vitest": "#2a78d6",
    "pytest": "#eb6834",
    "integration": "#1baf7a",
    "harness": "#eda100",
}
STAGE_COLORS = {"serialize": "#2a78d6", "deliver": "#eb6834", "parse": "#1baf7a"}
STAGE_LABELS = {"serialize": "serialização", "deliver": "entrega", "parse": "leitura"}
DEBUGGER_COLORS = {"gdb": "#2a78d6", "lldb": "#eb6834"}
LAYER_LABELS = {
    "vitest": "Vitest (TypeScript)",
    "pytest": "pytest (extrator)",
    "integration": "Integração (VS Code)",
    "harness": "Harness (GDB e LLDB)",
}
JUNIT_FILES = {"vitest": "vitest.xml", "pytest": "pytest.xml", "integration": "integracao.xml"}
VITEST_PROJECTS = [
    ("packages/contract/", "contract"),
    ("packages/webview/", "webview"),
    ("packages/extension/", "extension"),
    ("tests/", "harness"),
]

plt.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.size": 8,
        "axes.edgecolor": GRID,
        "axes.labelcolor": MUTED,
        "axes.titlecolor": INK,
        "axes.titlesize": 10,
        "axes.titleweight": "bold",
        "axes.titlelocation": "left",
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.color": GRID,
        "grid.linewidth": 0.6,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "text.color": INK,
    }
)


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def vitest_group(suite_name):
    for prefix, project in VITEST_PROJECTS:
        if suite_name.startswith(prefix):
            rest = suite_name[len(prefix):]
            rest = re.sub(r"^test/(unit/)?", "", rest)
            return project, rest
    return "outros", suite_name


def pytest_group(classname):
    parts = classname.split(".")
    module = next((part for part in parts if part.startswith("test_")), parts[-1])
    return "python", f"{module}.py"


def integration_group(case):
    return "integração", Path(case.get("file", "")).name.replace(".js", ".ts")


def read_junit(path, layer):
    try:
        root = ElementTree.parse(path).getroot()
    except (OSError, ElementTree.ParseError):
        return None

    suites = [root] if root.tag == "testsuite" else root.findall("testsuite")
    files = {}
    totals = {"tests": 0, "passed": 0, "skipped": 0, "failed": 0, "seconds": 0.0}

    for suite in suites:
        for case in suite.iter("testcase"):
            if layer == "vitest":
                key = vitest_group(suite.get("name", ""))
            elif layer == "pytest":
                key = pytest_group(case.get("classname", ""))
            else:
                key = integration_group(case)

            entry = files.setdefault(key, {"tests": 0, "failed": 0, "seconds": 0.0})
            seconds = float(case.get("time") or 0)
            failed = case.find("failure") is not None or case.find("error") is not None
            skipped = case.find("skipped") is not None

            entry["tests"] += 1
            entry["seconds"] += seconds
            entry["failed"] += int(failed)
            totals["tests"] += 1
            totals["seconds"] += seconds
            totals["failed"] += int(failed)
            totals["skipped"] += int(skipped)
            totals["passed"] += int(not failed and not skipped)

    return {"files": files, "totals": totals}


def harness_totals(harness):
    jobs = harness["jobs"]
    failed = sum(1 for job in jobs if job["status"] == "falha")
    return {
        "tests": len(jobs),
        "passed": len(jobs) - failed,
        "skipped": 0,
        "failed": failed,
        "seconds": sum(sum(job["seconds"].values()) for job in jobs),
    }


def load(reports):
    data = {
        "environment": read_json(reports / "environment.json") or {},
        "exit_codes": read_json(reports / "exit-codes.json") or {},
        "junit": {},
        "harness": read_json(reports / "harness.json"),
        "ts_coverage": read_json(reports.parent / "coverage" / "coverage-summary.json"),
        "py_coverage": read_json(reports / "pytest-cov.json"),
        "bench": read_json(reports / "bench.json"),
    }
    for layer, name in JUNIT_FILES.items():
        result = read_junit(reports / name, layer)
        if result is not None:
            data["junit"][layer] = result
    if "vitest" not in data["junit"]:
        data["ts_coverage"] = None
    if "pytest" not in data["junit"]:
        data["py_coverage"] = None
    return data


def layer_rows(data):
    rows = []
    for layer in LAYER_COLORS:
        totals = None
        if layer in data["junit"]:
            totals = data["junit"][layer]["totals"]
        elif layer == "harness" and data["harness"] is not None:
            totals = harness_totals(data["harness"])

        code = data["exit_codes"].get(layer)
        if totals is None:
            situation = "não executada" if code is None else "falhou sem resultado"
        elif code not in (None, 0) or totals["failed"] > 0:
            situation = "falhou"
        else:
            situation = "aprovada"
        rows.append((layer, totals, situation))
    return rows


def new_page(title, subtitle=None):
    figure = plt.figure(figsize=A4)
    figure.text(0.07, 0.955, title, fontsize=15, fontweight="bold", color=INK)
    if subtitle:
        figure.text(0.07, 0.935, subtitle, fontsize=8.5, color=MUTED)
    return figure


def style_table(table, header_rows=1):
    table.auto_set_font_size(False)
    table.set_fontsize(8)
    for (row, column), cell in table.get_celld().items():
        cell.set_edgecolor(GRID)
        cell.set_linewidth(0.6)
        if row < header_rows:
            cell.set_text_props(weight="bold", color=INK)
            cell.set_facecolor("#f3f2ef")


def summary_page(data):
    environment = data["environment"]
    rows = layer_rows(data)
    failed = any(situation.startswith("falhou") for _, _, situation in rows)
    figure = new_page("Relatório de testes", "DebugAlgo — as quatro camadas automáticas")

    facts = [
        ("Commit", environment.get("commit")),
        ("Data", environment.get("generatedAt")),
        ("Sistema", f"{environment.get('platform', '?')} {environment.get('release', '')}".strip()),
        ("Node", environment.get("node")),
        ("Python", environment.get("python")),
        ("GCC", environment.get("gcc")),
    ]
    if data["harness"] is not None:
        for key, version in data["harness"].get("debuggers", {}).items():
            facts.append((key.upper(), version))

    y = 0.89
    for label, value in facts:
        figure.text(0.07, y, label, fontsize=9, color=MUTED)
        figure.text(0.22, y, value or "—", fontsize=9, color=INK)
        y -= 0.022

    axis = figure.add_axes([0.07, y - 0.24, 0.86, 0.2])
    axis.axis("off")
    cells = []
    colors = []
    for layer, totals, situation in rows:
        if totals is None:
            cells.append([LAYER_LABELS[layer], "—", "—", "—", "—", "—", situation])
        else:
            cells.append(
                [
                    LAYER_LABELS[layer],
                    totals["tests"],
                    totals["passed"],
                    totals["skipped"],
                    totals["failed"],
                    f"{totals['seconds']:.1f} s",
                    situation,
                ]
            )
        colors.append(FAILURE if situation.startswith("falhou") else INK)

    table = axis.table(
        cellText=cells,
        colLabels=["Camada", "Testes", "Aprovados", "Pulados", "Falhos", "Tempo", "Situação"],
        colWidths=[0.3, 0.1, 0.12, 0.1, 0.1, 0.12, 0.2],
        loc="upper left",
        cellLoc="left",
    )
    style_table(table)
    table.scale(1, 1.7)
    for row, color in enumerate(colors, start=1):
        table[row, 6].get_text().set_color(color)
        table[row, 0].get_text().set_color(LAYER_COLORS[rows[row - 1][0]])
        table[row, 0].get_text().set_weight("bold")

    verdict = "Situação geral: alguma camada falhou" if failed else "Situação geral: aprovado"
    figure.text(
        0.07,
        y - 0.29,
        verdict,
        fontsize=12,
        fontweight="bold",
        color=FAILURE if failed else INK,
    )
    figure.text(
        0.07,
        y - 0.32,
        "No harness, cada teste é uma execução (alvo, variante ou sequência de pausas) "
        "sob os dois depuradores; o tempo soma os dois braços.",
        fontsize=8,
        color=MUTED,
    )
    return figure


def tests_page(data):
    entries = []
    for layer in ("vitest", "pytest", "integration"):
        if layer not in data["junit"]:
            continue
        files = data["junit"][layer]["files"]
        for (group, name), entry in sorted(files.items()):
            entries.append((layer, f"{group} · {name}", entry))
    if not entries:
        return None

    figure = new_page("Testes por arquivo", "quantidade de testes; ao lado, o tempo do arquivo")
    axis = figure.add_axes([0.42, 0.05, 0.5, 0.86])
    positions = list(range(len(entries)))[::-1]
    counts = [entry["tests"] for _, _, entry in entries]
    colors = [
        FAILURE if entry["failed"] else LAYER_COLORS[layer] for layer, _, entry in entries
    ]
    axis.barh(positions, counts, color=colors, height=0.68)
    axis.set_yticks(positions)
    axis.set_yticklabels([label for _, label, _ in entries], fontsize=6.5)
    axis.set_ylim(-0.6, len(entries) - 0.4)
    axis.grid(axis="y", visible=False)
    axis.set_xlabel("testes")
    top = max(counts)
    axis.set_xlim(0, top * 1.3)
    for position, (_, _, entry) in zip(positions, entries):
        axis.text(
            entry["tests"] + top * 0.015,
            position,
            f"{entry['tests']} · {entry['seconds']:.2f} s",
            va="center",
            fontsize=6,
            color=MUTED,
        )
    handles = [
        plt.Rectangle((0, 0), 1, 1, color=LAYER_COLORS[layer])
        for layer in ("vitest", "pytest", "integration")
        if layer in data["junit"]
    ]
    labels = [LAYER_LABELS[layer] for layer in ("vitest", "pytest", "integration") if layer in data["junit"]]
    axis.legend(handles, labels, loc="lower right", frameon=False, fontsize=7)
    return figure


def coverage_bars(axis, rows, color, title):
    positions = list(range(len(rows)))[::-1]
    axis.barh(positions, [value for _, value in rows], color=color, height=0.68)
    axis.set_yticks(positions)
    axis.set_yticklabels([name for name, _ in rows], fontsize=6.5)
    axis.set_ylim(-0.6, len(rows) - 0.4)
    axis.set_xlim(0, 112)
    axis.set_xticks([0, 25, 50, 75, 100])
    axis.grid(axis="y", visible=False)
    axis.set_title(title)
    for position, (_, value) in zip(positions, rows):
        axis.text(value + 1.2, position, f"{value:.0f}%", va="center", fontsize=6, color=MUTED)


def coverage_page(data, root):
    ts = data["ts_coverage"]
    py = data["py_coverage"]
    if ts is None and py is None:
        return None

    blocks = []
    if ts is not None:
        folders = {}
        for key, value in ts.items():
            if key == "total":
                continue
            folder = Path(os.path.relpath(key, root)).parent.as_posix().removeprefix("packages/")
            covered, total = folders.get(folder, (0, 0))
            folders[folder] = (covered + value["lines"]["covered"], total + value["lines"]["total"])
        rows = sorted(
            (folder, 100 * covered / max(total, 1)) for folder, (covered, total) in folders.items()
        )
        total = ts["total"]["lines"]["pct"]
        blocks.append(
            (rows, LAYER_COLORS["vitest"], f"TypeScript, por pasta — {total:.1f}% das linhas")
        )
    if py is not None:
        rows = sorted(
            (
                Path(name).name,
                100 * value["summary"]["covered_lines"] / max(value["summary"]["num_statements"], 1),
            )
            for name, value in py["files"].items()
        )
        totals = py["totals"]
        total = 100 * totals["covered_lines"] / max(totals["num_statements"], 1)
        blocks.append(
            (rows, LAYER_COLORS["pytest"], f"Python (extrator), por arquivo — {total:.1f}% das linhas")
        )

    figure = new_page("Cobertura de linhas", "medida sobre src/ inteiro e scripts/; sem limiar")
    sizes = [len(rows) + 4 for rows, _, _ in blocks]
    available = 0.86
    bottom = 0.91
    for (rows, color, title), size in zip(blocks, sizes):
        height = available * size / sum(sizes) - 0.03
        axis = figure.add_axes([0.42, bottom - height, 0.5, height - 0.02])
        coverage_bars(axis, rows, color, title)
        bottom -= height + 0.03
    return figure


def harness_table_page(harness):
    figure = new_page(
        "Harness: execuções",
        f"{len(harness['jobs'])} execuções em {harness['platform']}; forma do último snapshot do GDB",
    )
    axis = figure.add_axes([0.05, 0.04, 0.9, 0.88])
    axis.axis("off")
    cells = []
    for job in harness["jobs"]:
        cells.append(
            [
                job["target"],
                job["status"],
                job["roots"] if job["roots"] is not None else "—",
                job["nodes"] if job["nodes"] is not None else "—",
                job["edges"] if job["edges"] is not None else "—",
                job["frames"] if job["frames"] is not None else "—",
                job["pauses"],
                ", ".join(job["truncated"]) or "—",
            ]
        )
    table = axis.table(
        cellText=cells,
        colLabels=["Execução", "Situação", "Raízes", "Nós", "Arestas", "Quadros", "Pausas", "Truncamento"],
        colWidths=[0.34, 0.09, 0.08, 0.07, 0.08, 0.08, 0.08, 0.18],
        loc="upper left",
        cellLoc="left",
    )
    style_table(table)
    table.set_fontsize(6.5)
    table.scale(1, 1.05)
    for row, job in enumerate(harness["jobs"], start=1):
        if job["status"] == "falha":
            table[row, 1].get_text().set_color(FAILURE)
            table[row, 1].get_text().set_weight("bold")
    return figure


def harness_time_page(harness):
    jobs = harness["jobs"]
    keys = [key for key in ("gdb", "lldb") if any(key in job["seconds"] for job in jobs)]
    figure = new_page("Harness: tempo por depurador", "segundos por execução, do lançamento ao snapshot lido")
    axis = figure.add_axes([0.36, 0.05, 0.56, 0.86])
    positions = list(range(len(jobs)))[::-1]
    height = 0.8 / len(keys)
    for index, key in enumerate(keys):
        offset = (len(keys) - 1) / 2 * height - index * height
        axis.barh(
            [position + offset for position in positions],
            [job["seconds"].get(key, 0) for job in jobs],
            height=height * 0.92,
            color=DEBUGGER_COLORS[key],
            label=key.upper(),
        )
    axis.set_yticks(positions)
    axis.set_yticklabels([job["target"] for job in jobs], fontsize=6.5)
    axis.set_ylim(-0.6, len(jobs) - 0.4)
    axis.grid(axis="y", visible=False)
    axis.set_xlabel("segundos")
    totals = "   ".join(
        f"{key.upper()}: {sum(job['seconds'].get(key, 0) for job in jobs):.1f} s" for key in keys
    )
    axis.set_title(f"Total — {totals}")
    axis.legend(loc="lower right", bbox_to_anchor=(1, 1.0), ncol=len(keys), frameon=False)
    return figure


def bench_results(bench):
    loads = []
    for file in bench.get("testResults", []):
        for result in file.get("assertionResults", []):
            match = re.match(r"(.+) \| (\d+)$", result.get("title", ""))
            if not match or not result.get("benchmarks"):
                continue
            stages = {
                task["name"]: task["latency"] for task in result["benchmarks"][0]["tasks"]
            }
            loads.append({"name": match.group(1), "bytes": int(match.group(2)), "stages": stages})
    return loads


def transport_page(bench):
    loads = bench_results(bench)
    if not loads:
        return None
    synthetic = sorted((load for load in loads if load["name"].startswith("synthetic-")), key=lambda load: load["bytes"])
    real = [load for load in loads if not load["name"].startswith("synthetic-")]

    figure = new_page(
        "Transporte de uma pausa",
        "HttpWsChannel real em porta efêmera; média e faixa até o p99",
    )
    axis = figure.add_axes([0.1, 0.5, 0.82, 0.38])
    if synthetic:
        sizes = [load["bytes"] / 1024 for load in synthetic]
        for stage, color in STAGE_COLORS.items():
            means = [load["stages"][stage]["mean"] for load in synthetic]
            p99 = [load["stages"][stage]["p99"] for load in synthetic]
            axis.fill_between(sizes, means, p99, color=color, alpha=0.15, linewidth=0)
            axis.plot(sizes, means, color=color, linewidth=2, marker="o", markersize=4, label=STAGE_LABELS[stage])
            axis.annotate(
                STAGE_LABELS[stage],
                (sizes[-1], means[-1]),
                xytext=(6, 0),
                textcoords="offset points",
                va="center",
                fontsize=7,
                color=MUTED,
            )
        for load, size in zip(synthetic, sizes):
            axis.annotate(
                load["name"].replace("synthetic-", "") + " nós",
                (size, max(stage["p99"] for stage in load["stages"].values())),
                xytext=(0, 6),
                textcoords="offset points",
                ha="center",
                fontsize=6.5,
                color=MUTED,
            )
        axis.set_xlim(0, sizes[-1] * 1.12)
        axis.set_ylim(0, None)
        axis.set_xlabel("tamanho do envelope (kB)")
        axis.set_ylabel("tempo (ms)")
        axis.set_title("Carga sintética: nós record com um int e três arestas")
        axis.legend(loc="upper left", frameon=False)

    if real:
        table_axis = figure.add_axes([0.1, 0.04, 0.82, 0.36])
        table_axis.axis("off")
        table_axis.set_title("Snapshots reais (média, ms)")
        cells = [
            [
                load["name"],
                f"{load['bytes'] / 1024:.1f}",
                *(f"{load['stages'][stage]['mean']:.3f}" for stage in STAGE_COLORS),
            ]
            for load in sorted(real, key=lambda load: load["bytes"])
        ]
        table = table_axis.table(
            cellText=cells,
            colLabels=["Carga", "kB", "Serialização", "Entrega", "Leitura"],
            colWidths=[0.4, 0.12, 0.16, 0.16, 0.16],
            loc="upper left",
            cellLoc="left",
        )
        style_table(table)
        table.scale(1, 1.4)
    return figure


def pages(data, root):
    yield "resumo", summary_page(data)
    yield "testes-por-arquivo", tests_page(data)
    yield "cobertura", coverage_page(data, root)
    if data["harness"] is not None and data["harness"]["jobs"]:
        yield "harness-execucoes", harness_table_page(data["harness"])
        yield "harness-tempos", harness_time_page(data["harness"])
    if data["bench"] is not None:
        yield "transporte", transport_page(data["bench"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("reports", type=Path)
    parser.add_argument("--figures", type=Path)
    arguments = parser.parse_args()

    data = load(arguments.reports)
    output = arguments.reports / "relatorio-testes.pdf"
    if arguments.figures is not None:
        arguments.figures.mkdir(parents=True, exist_ok=True)

    count = 0
    with PdfPages(output) as pdf:
        for slug, figure in pages(data, arguments.reports.resolve().parent):
            if figure is None:
                continue
            pdf.savefig(figure)
            if arguments.figures is not None:
                figure.savefig(arguments.figures / f"{slug}.pdf")
            plt.close(figure)
            count += 1

    print(f"{output} ({count} páginas)")


if __name__ == "__main__":
    main()
