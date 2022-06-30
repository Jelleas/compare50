from __future__ import annotations

from collections import defaultdict
from tkinter.ttk import Progressbar
from typing import List, Dict, Set
import math

from tokenize import Token
from .. import Explainer, Explanation, Compare50Result, Span, Submission, File, Pass, Token
from ..comparators._winnowing import CompareIndex # TODO fix import
from .. import get_progress_bar

class Uniqueness(Explainer):
    name = "uniqueness"

    def __init__(self, k=25) -> None:
        self.k = k

    def explain(
        self, 
        results: List[Compare50Result], 
        submissions: List[Submission], 
        archive_submissions: List[Submission], 
        ignored_files: Set[File], 
        pass_: Pass
    ) -> List[Explanation]:
        progress_bar = get_progress_bar()
        progress_bar.reset(total=100)        
        
        file_to_tokens = get_file_to_tokens(submissions, archive_submissions, ignored_files)

        # Create an index for all regular files
        index = CompareIndex(self.k)
        for sub in submissions + archive_submissions:
            for f in sub.files:
                index.include(f, tokens=file_to_tokens[f])

        progress_bar.update(40)

        # Create an index for all ignored files
        ignored_index = CompareIndex(self.k)
        for f in ignored_files:
            ignored_index.include(f, tokens=file_to_tokens[f])
        
        progress_bar.update(10)

        # Ignore (remove) all ignored fingerprints
        index.ignore_all(ignored_index)

        # Find all fingerprints belonging to a span
        span_to_fingerprints: Dict[Span, List[int, Span]] = get_span_to_fingerprints(results, index, file_to_tokens)

        progress_bar.update(25)

        explanations: List[Explanation] = []

        n_submissions = len(submissions)

        # The highest score is only 2 submissions having the same fingerprint 
        max_idf_score = compute_idf(2, n_submissions)

        # For each matched span
        for matched_span, fingerprints in span_to_fingerprints.items():
            # print(matched_span._raw_contents())
            # print(matched_span)

            # Create an explanation for each fingerprint within the matched span
            for fingerprint, span in fingerprints:
                n_submissions_with_fingerprint = len({span.file.submission.id for span in index[fingerprint]})

                # print(fingerprint, span, len(index[fingerprint]), compute_idf(n_submissions_with_fingerprint, n_submissions))

                idf_score = compute_idf(n_submissions_with_fingerprint, n_submissions)
                percentage = n_submissions_with_fingerprint / n_submissions * 100
                explanations.append(Explanation(
                    span=span,
                    text=f"{percentage}% of submissions for this assignment contain this fingerprint.",
                    weight=idf_score / max_idf_score
                ))
        
        progress_bar.update(25)

        return explanations
    

def compute_idf(n_documents, total_n_documents: int) -> float:
    return 1 + math.log(n_documents / (1 + total_n_documents))

def get_span_to_fingerprints(
    results: List[Compare50Result],
    index: CompareIndex,
    file_to_tokens: Dict[File, Token]
) -> Dict[Span, List[int, Span]]:

    span_to_fingerprints = defaultdict(list)

    # Get all spans that the comparator found matches for
    all_matched_spans = {span for result in results for group in result.groups for span in group.spans}

    # Create a map from files to their matched_spans
    file_to_matched_spans = defaultdict(list)
    for span in all_matched_spans:
        file_to_matched_spans[span.file].append(span)

    # For each file
    for f in file_to_matched_spans:
        # Get its fingerprints and matched spans
        fingerprints = index.fingerprint(f, tokens=file_to_tokens[f])
        matched_spans = file_to_matched_spans[f]

        # Map a matched_span to a fingerprint
        # Iff the span of the fingerprint is a subregion of the matched_span
        for fingerprint, span in fingerprints:
            for matched_span in matched_spans:
                if span in matched_span:
                    span_to_fingerprints[matched_span].append([fingerprint, span])
                    break

    return span_to_fingerprints


def get_file_to_tokens(
    submissions: List[Submission], 
    archive_submissions: List[Submission], 
    ignored_files: Set[File]
) -> Dict[File, Token]:
    all_files = get_files_from_submissions(submissions + archive_submissions) + list(ignored_files)
    return {f: f.tokens() for f in all_files}


def get_files_from_submissions(submissions: List[Submission]) -> List[File]:
    return [f for sub in submissions for f in sub.files]