from .. import (
    Comparator,
    Score,
    FileSubmission,
    Comparison,
    Token,
    IdStore,
    File,
    Span,
    get_progress_bar
)

from typing import List, Set, Dict, Tuple, Iterable, FrozenSet

import collections
import itertools
import math

import attr
import farmhash
import pygments.token


@attr.s(slots=True, frozen=True)
class IdentifiableToken(Token):
    file: File = attr.ib(cmp=True, hash=True)
    id: int = attr.ib(cmp=False, hash=False)
    is_name = attr.ib(
        cmp=False,
        hash=False,
        init=False,
        default=attr.Factory(lambda self: self.type == pygments.token.Name, takes_self=True)
    )

    def to_span(self) -> Span:
        return Span(self.file, self.start, self.end)

@attr.s(slots=True, frozen=True)
class FingerprintedName:
    token: IdentifiableToken = attr.ib(cmp=False, hash=False)
    fingerprints: FrozenSet[int] = attr.ib()


class Names(Comparator):
    def __init__(self):
        pass

    def score(
        self,
        submissions: List[FileSubmission],
        archive_submissions: List[FileSubmission],
        ignored_files: Set[File]
    ) -> List[Score[FileSubmission, FileSubmission]]:
        bar = get_progress_bar()
        bar.reset(total=math.ceil((len(submissions) + len(archive_submissions)) / 0.9))

        idStore = IdStore()
        
        # Find all prints of names to ignore.
        ignored_names = self._get_ignored_names(ignored_files, idStore)

        # For each submission, find its names and fingerprints.
        sub_to_names: Dict[FileSubmission, List[FingerprintedName]] = {}
        for sub in submissions + archive_submissions:
            names = self._get_names(sub, idStore)
            names, _ = self._filter_ignored_names(names, ignored_names)
            sub_to_names[sub] = names
            bar.update()

        # Cross compare all submissions.
        scores: List[Score] = []
        for sub_a, sub_b in itertools.combinations(submissions, r=2):
            points = len(self._get_matching_names(sub_to_names[sub_a], sub_to_names[sub_b]))
            scores.append(Score(sub_a, sub_b, points))
        
        # Compare all submissions vs all archive submissions.
        for archive_sub in archive_submissions:
            for sub in submissions:
                points = len(self._get_matching_names(sub_to_names[sub], sub_to_names[archive_sub]))
                scores.append(Score(sub, archive_sub, points))

        return scores

    def compare(
        self,
        scores: List[Score[FileSubmission, FileSubmission]],
        ignored_files: Set[File]
    ) -> List[Comparison[FileSubmission, FileSubmission]]:
        idStore = IdStore()
        comparisons: List[Comparison] = []

        # Find all prints of names to ignore.
        ignored_names = self._get_ignored_names(ignored_files, idStore)
        
        # Grab all submissions from scores.
        submissions: Set[FileSubmission] = set()
        for score in scores:
            submissions.add(score.sub_a)
            submissions.add(score.sub_b)

        # Find all uncompared_spans, those are spans that dont contain names.
        sub_to_uncompared_spans: Dict[FileSubmission, List[Span]] = {}
        for sub in submissions:
            unprocessed_tokens: List[IdentifiableToken] = []
            for file in sub.files:
                unprocessed_tokens.extend(self._get_unprocessed_tokens(file, idStore))
            processed_tokens = self._process_tokens(sub, unprocessed_tokens)
            sub_to_uncompared_spans[sub] = [t.to_span() for t in processed_tokens if not t.is_name]

        # For each matching submission pair.
        for score in scores:
            # Get their names and prints.
            names_a = self._get_names(score.sub_a, idStore)
            names_b = self._get_names(score.sub_b, idStore)

            # Filter out any ignored names.
            names_a, ignored_names_a = self._filter_ignored_names(names_a, ignored_names)
            names_b, ignored_names_b = self._filter_ignored_names(names_b, ignored_names)

            # Find all names that match.
            matching_names = self._get_matching_names(names_a, names_b)

            # Create span matches of each matching name.
            span_matches: List[Tuple[Span, Span]] = [(a.token.to_span(), b.token.to_span()) for a, b in matching_names]

            # Create spans for all ignored names.
            ignored_spans = [n.token.to_span() for n in ignored_names_a + ignored_names_b]

            # Add all uncompared spans (spans that don't contain names) to ignored_spans.
            ignored_spans += sub_to_uncompared_spans[score.sub_a]
            ignored_spans += sub_to_uncompared_spans[score.sub_b]

            # Create the comparison's result.
            comparisons.append(Comparison(score.sub_a, score.sub_b, span_matches, ignored_spans))

        return comparisons

    def _filter_ignored_names(
        self,
        names: Iterable[FingerprintedName],
        ignored_names: Iterable[FingerprintedName]
    ) -> Tuple[List[FingerprintedName], List[FingerprintedName]]:
        new_names: List[FingerprintedName] = []
        new_ignored_names: List[FingerprintedName] = []
        
        ignored_names_set = set(ignored_names)
        for name in names:
            if name in ignored_names_set:
                new_ignored_names.append(name)
            else:
                new_names.append(name)
        
        return (new_names, new_ignored_names)

    def _get_matching_names(
        self,
        names_a: List[FingerprintedName],
        names_b: List[FingerprintedName]
    ) -> List[Tuple[FingerprintedName, FingerprintedName]]:
        names_a_dict = collections.defaultdict(list)
        for name in names_a:
            names_a_dict[name].append(name)

        names_b_dict = collections.defaultdict(list)
        for name in names_b:
            names_b_dict[name].append(name)

        matching_names: List[Tuple[FingerprintedName, FingerprintedName]] = []
        for name_a in names_a_dict:
            if name_a not in names_b_dict:
                continue
            matching_names.extend(itertools.product(names_a_dict[name_a], names_b_dict[name_a]))
        return matching_names

    def _get_names(
        self,
        submission: FileSubmission,
        store: IdStore,
        files: Iterable[File]=(),
    ) -> List[FingerprintedName]:
        if not files:
            files = submission.files
        
        unprocessed_tokens: List[IdentifiableToken] = []
        for file in files:
            unprocessed_tokens.extend(self._get_unprocessed_tokens(file, store))
        unprocessed_token_map = {t.id: t for t in unprocessed_tokens}
        processed_tokens = self._process_tokens(submission, unprocessed_tokens)

        indices = self._get_name_indices(processed_tokens)
        prints = self._fingerprint_names(processed_tokens, indices)

        name_to_names: Dict[IdentifiableToken, List[IdentifiableToken]] = collections.defaultdict(list)
        name_to_prints: Dict[IdentifiableToken, Set[int]] = collections.defaultdict(set)
        for name_token, fp in zip([processed_tokens[i] for i in indices], prints):
            name = unprocessed_token_map[name_token.id]
            name_to_prints[name].add(fp)
            name_to_names[name].append(name)

        # Filter any variables that don't occur at least twice
        names: List[FingerprintedName] = []
        for unique_name, fingerprints in name_to_prints.items():
            for name in name_to_names[unique_name]:
                if len(fingerprints) > 1:
                    names.append(FingerprintedName(name, frozenset(fingerprints)))

        return names

    def _get_ignored_names(self, ignored_files: Iterable[File], store: IdStore) -> List[FingerprintedName]:
        ignored_names: List[FingerprintedName] = []
        for file in ignored_files:
            names = self._get_names(file.submission, store, files=[file])
            ignored_names.extend(names)
        return ignored_names

    def _process_tokens(self, submission: FileSubmission, tokens: List[IdentifiableToken]) -> List[IdentifiableToken]:
        return list(submission.preprocessor(tokens))

    def _get_unprocessed_tokens(self, file: File, store: IdStore) -> List[IdentifiableToken]:
        file_tokens = file.unprocessed_tokens()
        return [
            IdentifiableToken(
                start=t.start,
                end=t.end,
                type=t.type,
                val=t.val,
                file=file,
                id=store[(file.id, t.val, t.start)]
            ) for t in file_tokens
        ]

    def _get_name_indices(self, tokens: List[IdentifiableToken]) -> List[int]:
        return [i for i, t in enumerate(tokens) if t.is_name]

    def _fingerprint_names(self, tokens: List[IdentifiableToken], indices: List[int]) -> List[int]:
        prints: List[int] = []
        for i in indices:
            start = max(0, i - 5)
            end = min(len(tokens) - 1, i + 5)
            fingerprint_tokens = tokens[start:end]
            fingerprint_text = "".join(t.val for t in fingerprint_tokens)
            prints.append(farmhash.hash32withseed(fingerprint_text, 50))
        return prints
