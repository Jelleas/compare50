from __future__ import annotations

from tokenize import Token
from .. import Explainer, Explanation, Compare50Result, Span, Submission, File, Pass, Token
from ..comparators._winnowing import CompareIndex # TODO fix import

from collections import defaultdict

class Uniqueness(Explainer):
    name = "uniqueness"

    def __init__(self, k=25) -> None:
        self.k = k

    def explain(
        self, 
        results: list[Compare50Result], 
        submissions: list[Submission], 
        archive_submissions: list[Submission], 
        ignored_files: set[File], 
        pass_: Pass
    ) -> list[Explanation]:
        
        file_to_tokens = get_file_to_tokens(submissions, archive_submissions, ignored_files)

        # Create an index for all regular files
        index = CompareIndex(self.k)
        for sub in submissions + archive_submissions:
            for f in sub.files:
                index.include(f, tokens=file_to_tokens[f])

        # Create an index for all ignored files
        ignored_index = CompareIndex(self.k)
        for f in ignored_files:
            ignored_index.include(f, tokens=file_to_tokens[f])
        
        # Ignore (remove) all ignored fingerprints
        index.ignore_all(ignored_index)

        span_to_tokens = get_span_to_tokens(results, file_to_tokens)

        return []
    

def get_span_to_tokens(
    results: list[Compare50Result],
    file_to_tokens: dict[File, Token]
) -> dict[Span, Token]:

    span_to_tokens = defaultdict(list)

    all_spans = {span for result in results for group in result.groups for span in group.spans}
    
    file_to_spans = defaultdict(list)
    for span in all_spans:
        file_to_spans[span.file].append(span)

    for f in file_to_spans:
        tokens = file_to_tokens[f]
        spans = file_to_spans[f]

        for token in tokens:
            token_span = Span(f, token.start, token.end)

            for span in spans:
                if token_span in span:
                    span_to_tokens[span].append(token)
                    break

    return span_to_tokens


def get_file_to_tokens(
    submissions: list[Submission], 
    archive_submissions: list[Submission], 
    ignored_files: set[File]
) -> dict[File, Token]:
    all_files = get_files_from_submissions(submissions + archive_submissions) + list(ignored_files)
    return {f: f.tokens() for f in all_files}


def get_files_from_submissions(submissions: list[Submission]) -> list[File]:
    return [f for sub in submissions for f in sub.files]