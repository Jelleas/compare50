import collections
import pathlib
from re import sub
import pkg_resources

STATIC = pathlib.Path(pkg_resources.resource_filename("compare50._renderer", "static"))
TEMPLATES = pathlib.Path(pkg_resources.resource_filename("compare50._renderer", "templates"))

from typing import Dict, List, Union, Any

from ._cluster import Cluster
from .. import _api, Compare50Result, Pass, Explanation, IdStore, Span, FileSubmission, File, Group

import jinja2


__all__ = ["render"]


def render(
    pass_to_results: Dict[Pass, List[Compare50Result]],
    dest: Union[str, pathlib.Path], 
    bundled: bool=False
) -> pathlib.Path:
    dest = pathlib.Path(dest)

    # Map each match to its results
    sub_pair_to_results = collections.defaultdict(list)
    for results in pass_to_results.values():
        for result in results:
            sub_pair_to_results[(result.sub_a, result.sub_b)].append(result)

    progress_bar = _api.get_progress_bar()
    progress_bar.reset(total=len(sub_pair_to_results) + 20)

    # Create a cluster    
    cluster = Cluster(sub_pair_to_results)
    progress_bar.update(20)

    renderer = render_bundled if bundled else render_multi
    return renderer(sub_pair_to_results, cluster, dest)


def render_multi(
    sub_pair_to_results: Dict[Pass, List[Compare50Result]],
    cluster: Cluster,
    dest: pathlib.Path
) -> str:
    progress_bar = _api.get_progress_bar()

    # Create the directory if it does not yet exist
    dest.mkdir(exist_ok=True)

    # Render matches
    for i, ((sub_a, sub_b), results) in enumerate(sub_pair_to_results.items()):
        subcluster = cluster.get_subcluster(sub_a)

        index = i + 1

        metadata = {
            "index": index,
            "numberOfMatches": len(sub_pair_to_results)
        }

        match_data = get_match_data(sub_a, sub_b, results, subcluster, metadata)

        match = _render_page({"MATCHES": {index: match_data}}, "match.html")

        # match = _render_page(match_data, "match.html")

        with open(dest / f"match_{index}.html", "w") as f:
            f.write(match)

        progress_bar.update()

    # Render home page
    data = get_home_data(cluster)
    home = _render_page(data, "home.html")

    home_path = dest / "index.html"
    with open(home_path, "w") as f:
        f.write(home)

    return home_path


def render_bundled(
    sub_pair_to_results: Dict[Pass, List[Compare50Result]],
    cluster: Cluster,
    dest: pathlib.Path
) -> str:
    progress_bar = _api.get_progress_bar()

    matches_data = {}

    # Render matches
    for i, ((sub_a, sub_b), results) in enumerate(sub_pair_to_results.items()):
        subcluster = cluster.get_subcluster(sub_a)

        index = i + 1

        metadata = {
            "index": index,
            "numberOfMatches": len(sub_pair_to_results)
        }

        matches_data[index] = get_match_data(sub_a, sub_b, results, subcluster, metadata)

        progress_bar.update()

    # Render home page
    home_data = get_home_data(cluster)

    data = dict(home_data)
    data.update({"MATCHES": matches_data})

    page = _render_page(data, "bundle.html")

    home_path = dest if dest.suffix.lower() == ".html" else dest.parent / (dest.name + '.html')
    with open(home_path, "w") as f:
        f.write(page)

    return home_path


def _render_page(data: Any, filename: str) -> str:
    with open(TEMPLATES / "page.html") as f:
        template = jinja2.Template(f.read(), autoescape=jinja2.select_autoescape(enabled_extensions=("html",)))
    rendered_data = template.render(DATA=data)
    with open(STATIC / filename) as f:
        page = f.read()
    
    return f"{rendered_data}\n{page}"


def get_home_data(cluster: Cluster) -> str:
    return {
        "SUBMISSIONS": cluster.submissions_as_dict(),
        "LINKS": cluster.links_as_dict()
    }


def get_match_data(
    sub_a: FileSubmission,
    sub_b: FileSubmission,
    results: List[Compare50Result],
    cluster: Cluster,
    metadata: Dict
) -> str:
    files_a = files_as_dict(sub_a)
    files_b = files_as_dict(sub_b)

    span_id_store: IdStore[Span] = IdStore()
    group_id_store: IdStore[Group] = IdStore()

    passes = [pass_as_dict(result, span_id_store, group_id_store) for result in results]

    match_data = {
        "METADATA": metadata,
        "SUB_A": files_a,
        "SUB_B": files_b,
        "PASSES": passes,
        "SUBMISSIONS": cluster.submissions_as_dict(),
        "LINKS": cluster.links_as_dict()
    }

    return match_data


def file_as_dict(file: File) -> Dict:
    return {
        "id": file.id,
        "name": str(file.name),
        "language": file.lexer().name,
        "content": file.read()
    }


def files_as_dict(submission: FileSubmission) -> Dict:
    return {
        "id": submission.id,
        "name": str(submission.path),
        "isArchive": submission.is_archive,
        "files": [file_as_dict(file) for file in submission.files]
    }


def span_as_dict(span: Span, span_id_store: IdStore, ignored: bool=False) -> Dict:
    return {
        "id": span_id_store[span],
        "subId": span.file.submission.id,
        "fileId": span.file.id,
        "start": span.start,
        "end": span.end,
        "ignored": ignored
    }


def pass_as_dict(result: Compare50Result, span_id_store: IdStore, group_id_store: IdStore) -> Dict:
    spans = []
    groups = []

    for group in result.groups:
        id = group_id_store[group]
        grouped_span_ids: List[int] = []

        for span in group.spans:
            grouped_span_ids.append(span_id_store[span])
            spans.append(span_as_dict(span, span_id_store))

        groups.append({"id": id, "spans": grouped_span_ids})

    for span in result.ignored_spans:
        spans.append(span_as_dict(span, span_id_store, ignored=True))

    explainers: List[Dict] = [
        {
            "name" : explainer.name,
            "explanations": [explanation_as_dict(exp, span_id_store) for exp in explanations]
        }
        for explainer, explanations in result.explanations.items()
    ]

    return {
        "name": result.pass_.__name__, # type: ignore
        "docs": result.pass_.__doc__,
        "score": result.score.score,
        "spans": spans,
        "groups": groups,
        "explainers": explainers
    }


def explanation_as_dict(explanation: Explanation, span_id_store: IdStore[Span]) -> Dict:
    return {
        "span": span_as_dict(explanation.span, span_id_store),
        "text": explanation.text,
        "weight": explanation.weight,
    }