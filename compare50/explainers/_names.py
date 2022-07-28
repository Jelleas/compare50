from .. import Explainer, Compare50Result, Comparator, FileSubmission, File, Explanation, Token, IdStore

from typing import List, Set, Dict

import collections

import attr
import farmhash
import pygments.token


@attr.s(slots=True, frozen=True)
class IdentifiableToken(Token):
    file = attr.ib(cmp=False, hash=False)
    id = attr.ib(cmp=False, hash=False)


class Names(Explainer):
    name = "similar names"

    def explain(
        self, 
        comparator: Comparator,
        results: List[Compare50Result], 
        submissions: List[FileSubmission], 
        archive_submissions: List[FileSubmission], 
        ignored_files: Set[File]
    ) -> List[Explanation]:
        result = results[0]
        sub_a = result.sub_a
        sub_b = result.sub_b
        idStore = IdStore()
        variable_to_prints_a = self._get_variable_to_prints(sub_a, idStore)
        variable_to_prints_b = self._get_variable_to_prints(sub_b, idStore)

        # for name_token, fps in variable_to_prints_a.items():
        #     print(name_token.val, name_token.file.id, fps)

        return []

    def _get_variable_to_prints(self, submission: FileSubmission, store: IdStore) -> Dict[IdentifiableToken, List[int]]:
        unprocessed_tokens = self._get_unprocessed_tokens(submission, store)
        unprocessed_token_map = {t.id: t for t in unprocessed_tokens}
        processed_tokens = self._process_tokens(submission, unprocessed_tokens)

        indices = self._get_name_indices(processed_tokens)
        prints = self._fingerprint_names(processed_tokens, indices)

        variable_to_prints: Dict[IdentifiableToken, List[int]] = collections.defaultdict(list)
        for name_token, fp in zip([processed_tokens[i] for i in indices], prints):
            variable_to_prints[unprocessed_token_map[name_token.id]].append(fp)

        return variable_to_prints

    def _process_tokens(self, submission: FileSubmission, tokens: List[IdentifiableToken]) -> List[IdentifiableToken]:
        return list(submission.preprocessor(tokens))

    def _get_unprocessed_tokens(self, submission: FileSubmission, store: IdStore) -> List[IdentifiableToken]:
        tokens: List[IdentifiableToken] = []
        for file in submission.files:
            file_tokens = file.unprocessed_tokens()
            identifiable_file_tokens = [
                IdentifiableToken(
                    start=t.start,
                    end=t.end,
                    type=t.type,
                    val=t.val,
                    file=file,
                    id=store.get((file.id, t.val))
                ) for t in file_tokens
            ]
            tokens.extend(identifiable_file_tokens)
        return tokens

    def _get_name_indices(self, tokens: List[IdentifiableToken]) -> List[int]:
        return [i for i, t in enumerate(tokens) if t.type in pygments.token.Name]

    def _fingerprint_names(self, tokens: List[IdentifiableToken], indices: List[int]) -> List[int]:
        prints: List[int] = []
        for i in indices:
            start = max(0, i - 5)
            end = min(len(tokens) - 1, i + 5)
            fingerprint_tokens = tokens[start:end]
            fingerprint_text = "".join(t.val for t in fingerprint_tokens)
            prints.append(farmhash.hash32withseed(fingerprint_text, 50))
        return prints