"""Rebuild the local source graph; semantic documentation fragments are preserved."""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "graphify-out"
sys.path.insert(0, str(OUT / "python-deps"))

from graphify.extract import extract
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report
from graphify.detect import detect, save_manifest


def main():
    detection = detect(ROOT, extra_excludes=["graphify-out/**", ".graphify_cache/**"])
    (OUT / ".graphify_detect.json").write_text(json.dumps(detection), encoding="utf-8")
    source = [Path(p) for p in detection["files"]["code"]]
    ast = extract(source, cache_root=ROOT, parallel=False)
    fragments = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(OUT.glob(".graphify_chunk_*.json"))]
    result = dict(ast)
    result["nodes"] = list(ast["nodes"])
    result["edges"] = list(ast["edges"])
    result["hyperedges"] = []
    seen = {n["id"] for n in result["nodes"]}
    for fragment in fragments:
        for node in fragment["nodes"]:
            if node["id"] not in seen:
                result["nodes"].append(node)
                seen.add(node["id"])
        result["edges"].extend(fragment["edges"])
        result["hyperedges"].extend(fragment.get("hyperedges", []))
    (OUT / ".graphify_extract.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    graph = build_from_json(result, root=ROOT, directed=False)
    if not graph.number_of_nodes():
        raise RuntimeError("Empty graph; existing outputs preserved")
    communities = cluster(graph)
    cohesion = score_all(graph, communities)
    labels = {}
    for cid, members in communities.items():
        counts = Counter()
        for member in members:
            file = str(graph.nodes[member].get("source_file", "")).replace("\\", "/")
            parts = file.split("/")
            stem = Path(file).stem
            label = parts[-2] + " page" if stem == "page" and len(parts) > 1 else stem.replace("-", " ").replace("_", " ")
            counts[label] += 1
        labels[cid] = counts.most_common(1)[0][0] or "Project configuration"
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)
    questions = suggest_questions(graph, communities, labels)
    if not to_json(graph, communities, str(OUT / "graph.json"), community_labels=labels):
        raise RuntimeError("Graph export refused; existing outputs preserved")
    tokens = {"input": 0, "output": 0}
    report = generate(graph, communities, cohesion, labels, gods, surprises, detection, tokens, str(ROOT), suggested_questions=questions)
    report += f"\n\nScope note: {len(source)} code files were structurally scanned. Documentation fragments retain the 28-file semantic snapshot from 2026-10-10; newly added documentation is not semantically indexed by this structural refresh. Generated images are excluded. See SOURCE_COVERAGE.json, CODE_AUDIT.md and docs/BUGFIXES.md.\n"
    report += "\nCost note: structural extraction uses no LLM tokens. Host-agent documentation token usage is unavailable; zero counters do not mean zero usage.\n"
    (OUT / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    (OUT / ".graphify_labels.json").write_text(json.dumps(labels), encoding="utf-8")
    diagnostic = diagnose_extraction(result, directed=False, root=ROOT)
    (OUT / "GRAPH_HEALTH.md").write_text(format_diagnostic_report(diagnostic), encoding="utf-8")
    if graph.number_of_nodes() > 5000:
        print("Warning: graph exceeds 5,000 nodes; visualization may be slow")
    to_html(graph, communities, str(OUT / "graph.html"), community_labels=labels)
    files = []
    for file in source:
        text = file.read_text(encoding="utf-8", errors="replace")
        files.append({"path": file.relative_to(ROOT).as_posix(), "lines": len(text.splitlines()), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
    (OUT / "SOURCE_COVERAGE.json").write_text(json.dumps({"method": "All detected first-party code read by structural extraction; manual flow review is separately scoped in CODE_AUDIT.md", "files": files}, indent=2), encoding="utf-8")
    stamped = {"code": detection["files"]["code"], "document": detection["files"]["document"]}
    save_manifest(stamped, root=ROOT)
    print(f"Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, {len(communities)} communities")
    print(format_diagnostic_report(diagnostic))


if __name__ == "__main__":
    main()
