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

from typing import List, Set, Dict, Tuple, Sequence

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


@attr.s(slots=True, frozen=True)
class FingerprintedName:
    token: IdentifiableToken = attr.ib(cmp=False, hash=False)
    fingerprints: Set[int] = attr.ib()


class Names(Comparator):
    def __init__(self):
        pass

    def score(self, submissions, archive_submissions, ignored_files):
        bar = get_progress_bar()
        bar.reset(total=math.ceil((len(submissions) + len(archive_submissions)) / 0.9))

        idStore = IdStore()
        
        # Find all prints of names to ignore.
        ignored_names = self._get_ignored_names(ignored_files, idStore)

        # For each submission, find its names and fingerprints.
        sub_to_names: Dict[FileSubmission, List[FingerprintedName]] = {}
        for sub in submissions + archive_submissions:
            sub_to_names[sub] = self._get_names(sub, idStore, ignored_names=ignored_names)
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

    def compare(self, scores, ignored_files):
        idStore = IdStore()
        comparisons: List[Comparison] = []

        # Find all prints of names to ignore.
        ignored_names = self._get_ignored_names(ignored_files, idStore)
        
        # For each matching submission pair.
        for score in scores:
            # Get their names and prints.
            names_a = self._get_names(score.sub_a, idStore)
            names_b = self._get_names(score.sub_b, idStore)

            # Find all names that match.
            matching_names = self._get_matching_names(names_a, names_b)

            # Create spans (regions within a submission) that match.
            span_matches: List[Span] = []
            for a, b in matching_names:
                span_matches.append((
                    Span(a.token.file, a.token.start, a.token.end),
                    Span(b.token.file, b.token.start, b.token.end)
                ))
            
            # Create the comparison's result.
            comparisons.append(Comparison(
                score.sub_a, 
                score.sub_b,
                span_matches,
                []
            ))

        return comparisons

    def _get_matching_names(
        self,
        names_a: List[FingerprintedName],
        names_b: List[FingerprintedName]
    ) -> List[Tuple[FingerprintedName, FingerprintedName]]:
        matching_names: List[Tuple[FingerprintedName, FingerprintedName]] = []
        for name_a, name_b in itertools.product(names_a, names_b):
            if name_a == name_b:
                matching_names.append((name_a, name_b))
        return matching_names

    def _get_names(
        self,
        submission: FileSubmission,
        store: IdStore,
        files: Sequence[File]=(),
        ignored_names: Sequence[FingerprintedName]=()
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

        name_to_prints: Dict[IdentifiableToken, Set[int]] = collections.defaultdict(set)
        for name_token, fp in zip([processed_tokens[i] for i in indices], prints):
            name_to_prints[unprocessed_token_map[name_token.id]].add(fp)

        # Filter any variables that don't occur at least twice or are part of ignored prints
        ignored_prints: List[Set[int]] = [name.fingerprints for name in ignored_names]
        names: List[FingerprintedName] = []
        for name, fingerprints in name_to_prints.items():
            if len(fingerprints) > 1 and fingerprints not in ignored_prints:
                names.append(FingerprintedName(name, fingerprints))

        return names

    def _get_ignored_names(self, ignored_files: Sequence[File], store: IdStore) -> List[FingerprintedName]:
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
                id=store[(file.id, t.val)]
            ) for t in file_tokens
        ]

    def _get_name_indices(self, tokens: List[IdentifiableToken]) -> List[int]:
        return [i for i, t in enumerate(tokens) if t.type == pygments.token.Name]

    def _fingerprint_names(self, tokens: List[IdentifiableToken], indices: List[int]) -> List[int]:
        prints: List[int] = []
        for i in indices:
            start = max(0, i - 5)
            end = min(len(tokens) - 1, i + 5)
            fingerprint_tokens = tokens[start:end]
            fingerprint_text = "".join(t.val for t in fingerprint_tokens)
            prints.append(farmhash.hash32withseed(fingerprint_text, 50))
        return prints
