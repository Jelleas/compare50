from collections import defaultdict
from typing import List, Dict, Set, Union
import math

from .. import ServerComparator, Error, Comparator, Explainer, Explanation, Compare50Result, Span, FileSubmission, File, SourcedFingerprint
from .. import get_progress_bar

class Index:
    def __init__(self, comparator: ServerComparator):
        self.comparator = comparator
        self._index: Dict[SourcedFingerprint, List[SourcedFingerprint]] = defaultdict(list)

    def include(self, submission: FileSubmission) -> None:
        for f in submission.files:
            for fp in self.comparator.fingerprint_for_compare(f):
                self._index[fp].append(fp)

    def ignore(self, file: File) -> None:
        for fp in self.comparator.fingerprint_for_compare(file):
            self._index.pop(fp, None)

    def get_n_submissions_with_fingerprint(self, fingerprint: SourcedFingerprint) -> int:
        return len({fp.span.file.submission.id for fp in self._index[fingerprint]})

    def get_span_to_fingerprints(self, results: List[Compare50Result]) -> Dict[Span, List[SourcedFingerprint]]:
        file_to_fingerprints = defaultdict(list)
        for fingerprints in self._index.values():
            for fingerprint in fingerprints:
                file_to_fingerprints[fingerprint.span.file].append(fingerprint)

        # Get all spans that the comparator found matches for
        all_matched_spans: Set[Span] = {span for result in results for group in result.groups for span in group.spans}

        # Create a map from files to their matched_spans
        file_to_matched_spans = defaultdict(list)
        for span in all_matched_spans:
            file_to_matched_spans[span.file].append(span)

        span_to_fingerprints = defaultdict(list)

        # For each file
        for f in file_to_matched_spans:
            # Get its fingerprints and matched spans
            fingerprints = file_to_fingerprints[f]
            matched_spans = file_to_matched_spans[f]

            # Map a matched_span to a fingerprint
            # Iff the span of the fingerprint is a subregion of the matched_span
            for fingerprint in fingerprints:
                for matched_span in matched_spans:
                    if fingerprint.span in matched_span:
                        span_to_fingerprints[matched_span].append(fingerprint)
                        break

        return span_to_fingerprints

class Uniqueness(Explainer):
    name = "uniqueness"

    def explain(
        self, 
        comparator: Union[Comparator, ServerComparator],
        results: List[Compare50Result], 
        submissions: List[FileSubmission], 
        archive_submissions: List[FileSubmission], 
        ignored_files: Set[File]
    ) -> List[Explanation]:
        if not isinstance(comparator, ServerComparator):
            raise Error("Uniqueness explainer needs a ServerComparator, please update your pass.")

        progress_bar = get_progress_bar()
        progress_bar.reset(total=100)        
        
        # Create an index for all regular files
        index = Index(comparator)
        all_submissions = submissions + archive_submissions
        step = 40 / len(all_submissions)
        for sub in all_submissions:
            index.include(sub)
            progress_bar.update(step)
        
        # Ignore all ignored files
        for f in ignored_files:
            index.ignore(f)
        progress_bar.update(10)

        # Find all fingerprints belonging to a span
        span_to_fingerprints: Dict[Span, List[SourcedFingerprint]] = index.get_span_to_fingerprints(results)

        progress_bar.update(25)

        explanations: List[Explanation] = []

        n_submissions = len(submissions)

        # The highest score is only 2 submissions having the same fingerprint 
        max_idf_score = compute_idf(2, n_submissions)

        # For each matched span get its fingerprints
        for fingerprints in span_to_fingerprints.values():
            # Create an explanation for each fingerprint within the matched span
            for fingerprint in fingerprints:
                n_submissions_with_fingerprint = index.get_n_submissions_with_fingerprint(fingerprint)
                idf_score = compute_idf(n_submissions_with_fingerprint, n_submissions)
                percentage = n_submissions_with_fingerprint / n_submissions * 100
                explanations.append(Explanation(
                    span=fingerprint.span,
                    text=f"{n_submissions_with_fingerprint} submissions contain a similar snippet of code."\
                    f" That is {round(percentage, 1)}% of all submissions for this assignment.",
                    weight=idf_score / max_idf_score,
                    explainer=self
                ))
        
        progress_bar.update(25)

        return explanations

    def __hash__(self):
        return hash(self.name)


def compute_idf(n_documents: int, total_n_documents: int) -> float:
    if n_documents == 0 or total_n_documents == 0:
        return 0
    return 1 + math.log(total_n_documents / n_documents)
