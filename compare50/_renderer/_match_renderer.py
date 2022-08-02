import jinja2

from typing import List, Dict

from ._renderer import STATIC, TEMPLATES
from .._data import IdStore

from .. import FileSubmission, Compare50Result, File, Span, Compare50Result, Explanation, Group
from ._cluster import Cluster

def render_match(sub_a: FileSubmission, sub_b: FileSubmission, results: List[Compare50Result], cluster: Cluster, metadata: Dict) -> str:
    files_a = files_as_dict(sub_a)
    files_b = files_as_dict(sub_b)

    span_id_store: IdStore[Span] = IdStore()
    group_id_store: IdStore[Group] = IdStore()

    passes = [pass_as_dict(result, span_id_store, group_id_store) for result in results]

    with open(TEMPLATES / "match.html") as f:
        template = jinja2.Template(f.read(), autoescape=jinja2.select_autoescape(enabled_extensions=("html",)))

    with open(STATIC / "match.html") as f:
        match_page = f.read()

    rendered_data = template.render(
        match_page=match_page,
        METADATA=metadata,
        FILES_A=files_a, 
        FILES_B=files_b, 
        PASSES=passes, 
        SUBMISSIONS=cluster.submissions_as_dict(), 
        LINKS=cluster.links_as_dict()
    )

    return rendered_data + "\n" + match_page


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


def explanation_as_dict(explanation: Explanation, span_id_store: IdStore) -> Dict:
    return {
        "span": span_as_dict(explanation.span, span_id_store),
        "text": explanation.text,
        "weight": explanation.weight,
    }