from .. import (
    Comparator,
    Score,
    FileSubmission,
    Comparison,
    Token,
    IdStore,
    File,
    Span,
    Fingerprint,
    SourcedFingerprint,
    progress_bar
)

from typing import List, Set, Dict, Tuple

import collections
import itertools
import math

import attr
import farmhash
import pygments.token


@attr.s(slots=True, frozen=True)
class IdentifiableToken(Token):
    file = attr.ib(cmp=False, hash=False)
    id = attr.ib(cmp=False, hash=False)


class Names(Comparator):
    def __init__(self):
        pass

    def score(self, submissions, archive_submissions, ignored_files):
        bar = progress_bar()
        bar.reset(total=math.ceil((len(submissions) + len(archive_submissions)) / 0.9))

        idStore = IdStore()
        sub_to_prints: Dict[FileSubmission, Dict[IdentifiableToken, List[int]]] = {}
        for sub in submissions + archive_submissions:
            sub_to_prints[sub] = self._get_name_to_prints(sub, idStore)
            bar.update()

        scores: List[Score] = []
        for sub_a, sub_b in itertools.combinations(submissions, r=2):
            points = len(self._get_matching_names(sub_to_prints[sub_a], sub_to_prints[sub_b]))
            scores.append(Score(sub_a, sub_b, points))
        
        for archive_sub in archive_submissions:
            for sub in submissions:
                points = len(self._get_matching_names(sub_to_prints[sub], sub_to_prints[archive_sub]))
                scores.append(Score(sub, archive_sub, points))

        return scores

    def compare(self, scores, ignored_files):
        idStore = IdStore()
        comparisons: List[Comparison] = []

        for score in scores:
            name_to_prints_a = self._get_name_to_prints(score.sub_a, idStore)
            name_to_prints_b = self._get_name_to_prints(score.sub_b, idStore)
            matching_names = self._get_matching_names(name_to_prints_a, name_to_prints_b)

            span_matches: List[Span] = []
            for var_a, var_b in matching_names:
                span_matches.append((
                    Span(var_a.file, var_a.start, var_a.end),
                    Span(var_b.file, var_b.start, var_b.end)
                ))
            
            comparisons.append(Comparison(
                score.sub_a, 
                score.sub_b,
                span_matches,
                []
            ))

        return comparisons

    def fingerprint_for_compare(self, file: File) -> List[SourcedFingerprint]:
        raise NotImplementedError()
        store = IdStore()
        unprocessed_tokens = self._get_unprocessed_tokens(file, store)
        unprocessed_token_map = {t.id: t for t in unprocessed_tokens}
        processed_tokens = self._process_tokens(file.submission, unprocessed_tokens)

        indices = self._get_name_indices(processed_tokens)
        prints = self._fingerprint_names(processed_tokens, indices)
        return super().fingerprint_for_compare(file)

    def fingerprint_for_score(self, file: File) -> List[Fingerprint]:
        raise NotImplementedError()
    
    def _get_matching_names(
        self,
        name_to_prints_a: FileSubmission,
        name_to_prints_b: Dict[IdentifiableToken, List[int]]
    ) -> List[Tuple[IdentifiableToken, IdentifiableToken]]:

        matching_names: List[Tuple[IdentifiableToken, IdentifiableToken]] = []

        for (name_a, prints_a), (name_b, prints_b) in itertools.product(name_to_prints_a.items(), name_to_prints_b.items()):
            if prints_a == prints_b:
                matching_names.append((name_a, name_b))

        return matching_names

    def _get_name_to_prints(self, submission: FileSubmission, store: IdStore) -> Dict[IdentifiableToken, Set[int]]:
        unprocessed_tokens: List[IdentifiableToken] = []
        for file in submission.files:
            unprocessed_tokens.extend(self._get_unprocessed_tokens(file, store))
        unprocessed_token_map = {t.id: t for t in unprocessed_tokens}
        processed_tokens = self._process_tokens(submission, unprocessed_tokens)

        indices = self._get_name_indices(processed_tokens)
        prints = self._fingerprint_names(processed_tokens, indices)

        name_to_prints: Dict[IdentifiableToken, Set[int]] = collections.defaultdict(set)
        for name_token, fp in zip([processed_tokens[i] for i in indices], prints):
            name_to_prints[unprocessed_token_map[name_token.id]].add(fp)

        # Filter any variables that don't occur at least twice.
        filtered_name_to_prints: Dict[IdentifiableToken, Set[int]] = {}
        for var, fingerprints in name_to_prints.items():
            if len(fingerprints) > 1:
                filtered_name_to_prints[var] = fingerprints

        return filtered_name_to_prints

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
                id=store.get((file.id, t.val))
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
