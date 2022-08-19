
from typing import List, Set, Tuple, Dict, Optional, Any, Iterable, Union

import collections
import heapq

import intervaltree
import tqdm

import concurrent.futures
from ._data import (
    FileSubmission,
    FingerprintSubmission,
    Pass,
    Span,
    Token,
    Score, 
    File,
    Group,
    BisectList,
    Compare50Result,
    Fingerprint,
    Comparison,
    SourcedFingerprint,
    ServerComparator,
    SingleSourceComparison
)


__all__ = ["rank", "get_results", "missing_spans", "expand", "init_progress_bar", "get_progress_bar", "Error"]


class Error(Exception):
    """Base class for compare50 errors."""
    pass


def rank(
    submissions: List[FileSubmission], 
    archive_submissions: List[FileSubmission], 
    ignored_files: Set[File], 
    pass_: Pass, 
    n: int=50
) -> List[Score[FileSubmission, FileSubmission]]:
    """
    :param submissions: submissions to be ranked
    :type submissions: [:class:`compare50.FileSubmission`]
    :param archive_submissions: archive submissions to be ranked
    :type archive_submissions: [:class:`compare50.FileSubmission`]
    :param ignored_files: files containing distro code
    :type ignored_files: {:class:`compare50.File`}
    :param pass_: pass whose comparator should be use to rank the submissions
    :type pass_: :class:`compare50.Pass`
    :param n: number of submission pairs to return
    :type n: int
    :returns: the top ``n`` submission pairs
    :rtype: [:class:`compare50.Score`]


    Rank submissions, return the top ``n`` most similar pairs
    """
    scores = pass_.comparator.score(submissions, archive_submissions, ignored_files)
 
    # Keep only top `n` submission matches
    return heapq.nlargest(n, scores)


def rank_fingerprints(
    submissions: List[FingerprintSubmission], 
    archive: List[FingerprintSubmission], 
    ignored: Set[Fingerprint], 
    comparator: ServerComparator, 
    n: int=50
) -> List[Score[FingerprintSubmission, FingerprintSubmission]]:
    """
    :param submission: submission to be ranked
    :type submissions: [:class:`compare50.Fingerprint`]
    :param archive: archive fingerprints to be used in ranking
    :type archiv: [:class:`compare50.Fingerprint`]
    :param ignored: fingerprints extracted from distro code
    :type ignored: {:class:`compare50.Fingerprint`}
    :param comparator: server comparator to be used to rank the submissions
    :type comparator: :class:`compare50.ServerComparator`
    :param n: number of submission pairs to return
    :type n: int
    :returns: the top ``n`` submission pairs
    :rtype: [:class:`compare50.Score`]


    Rank submissions, return the top ``n`` most similar pairs
    """
    scores = comparator.score_fingerprints(submissions, archive, ignored)

    scores = [score for score in scores if score.sub_a.submitter != score.sub_b.submitter]
 
    # Keep only top `n` submission matches
    return heapq.nlargest(n, scores)
 

def get_results(
    pass_: Pass,
    comparisons: Iterable[Comparison],
    scores: Iterable[Score]
) -> List[Compare50Result]:
    """
    :param pass_: the pass_ that produced the comparisons and scores
    :type pass_: [:class:`compare50.Pass`]
    :param comparisons: an iterable of in-depth comparisons
    :type comparisons: [:class:`compare50.Comparison`]
    :param scores: an iterable of scores
    :type scores: [:class:`compare50.Comparison`]
    :returns: Compare50Result for each score and comparison pair.
    :rtype: [:class:`compare50.Compare50Result`]


    For each pair of comparison and score (same submissions) produce a Compare50Result.
    Ensures that: 
    * Spans in the comparison do not overlap.
    * Any spans in the comparison are extended to maximum matching size.
    * All spans that were removed by a preprocessor are found again and properly ignored.
    """

    if not comparisons:
        return []

    missing_spans_cache: Dict[File, List[Span]] = {}
    sub_match_to_ignored_spans: Dict[Tuple[FileSubmission, FileSubmission], List[Span]] = {}
    sub_match_to_groups: Dict[Tuple[FileSubmission, FileSubmission], List[Group]] = {}

    for comparison in comparisons:
        new_ignored_spans: List[Span] = []
        for sub in (comparison.sub_a, comparison.sub_b):
            for file in sub.files:
                # Divide ignored_spans per file
                ignored_spans_file = [span for span in comparison.ignored_spans
                                           if span.file == file]

                # Find all spans lost by preprocessors for file_a
                if file not in missing_spans_cache:
                    missing_spans_cache[file] = missing_spans(file)
                ignored_spans_file.extend(missing_spans_cache[file])

                # Flatten the spans (they could be overlapping)
                new_ignored_spans += _flatten_spans(ignored_spans_file)

        sub_match_to_ignored_spans[(comparison.sub_a, comparison.sub_b)] = new_ignored_spans

        sub_match_to_groups[(comparison.sub_a, comparison.sub_b)] = _group_span_matches(comparison.span_matches)

    results: List[Compare50Result[Score[FileSubmission, FileSubmission]]] = []
    for score in scores:
        sub_match = (score.sub_a, score.sub_b)
        results.append(Compare50Result(pass_,
                                       score,
                                       sub_match_to_groups.get(sub_match, []),
                                       sub_match_to_ignored_spans[sub_match]))

    return results


def get_single_source_results(
    pass_: Pass,
    comparisons: Iterable[SingleSourceComparison],
    scores: Iterable[Score[FileSubmission, FingerprintSubmission]]
) -> List[Compare50Result]:

    subs_to_comparison: Dict[Tuple[FileSubmission, FingerprintSubmission], SingleSourceComparison] = {}
    for comp in comparisons:
        subs_to_comparison[(comp.sub_a, comp.sub_b)] = comp

    results: List[Compare50Result] = []
    for score in scores:
        comp = subs_to_comparison[(score.sub_a, score.sub_b)]
        matching_spans = _flatten_spans(comp.matching_spans)
        ignored_spans = _flatten_spans(comp.ignored_spans)
        groups = [Group([s]) for s in matching_spans]  # type: ignore
        
        results.append(Compare50Result(
            pass_,
            score,
            groups,
            ignored_spans
        ))

    return results


def fingerprint_for_compare(
    submissions: List[FileSubmission],
    comparator: ServerComparator
) -> List[List[SourcedFingerprint]]:
    """
    :param submissions: submissions to be fingerprinted
    :type submissions: [:class:`compare50.FileSubmission`]
    :param pass_: pass whose comparator should be use to fingerprint the submissions
    :type pass_: :class:`compare50.Pass`
   
    Fingerprint submissions
    """
    all_fingerprints: List[List[SourcedFingerprint]] = []
    for submission in submissions:
        fps: List[SourcedFingerprint] = []
        for file in submission.files:
            fps.extend(comparator.fingerprint_for_compare(file))
        all_fingerprints.append(fps)
    return all_fingerprints


def fingerprint_for_score(
    submissions: List[FileSubmission],
    comparator: ServerComparator
) -> List[List[Fingerprint]]:
    """
    :param submissions: submissions to be fingerprinted
    :type submissions: [:class:`compare50.FileSubmission`]
    :param pass_: pass whose comparator should be use to fingerprint the submissions
    :type pass_: :class:`compare50.Pass`

    Fingerprint submissions
    """
    all_fingerprints: List[List[Fingerprint]] = []
    for submission in submissions:
        fps: List[Fingerprint] = []
        for file in submission.files:
            fps.extend(comparator.fingerprint_for_score(file))
        all_fingerprints.append(fps)
    return all_fingerprints


def missing_spans(
    file: File,
    original_tokens: Optional[List[Token]]=None,
    processed_tokens: Optional[List[Token]]=None
) -> List[Span]:
    """
    :param file: file to be examined
    :type file: :class:`compare50.File`
    :param original_tokens: the unprocessed tokens of ``file``. May be \
            optionally specified if ``file`` has been tokenized elsewhere to avoid \
            tokenizing it again.
    :param processed_tokens: the result of preprocessing the tokens of ``file``. \
            May optionally be specified if ``file`` has been preprocessed elsewhere \
            to avoid doing so again.
    :returns: The spans of ``file`` that were stripped by the preprocessor.
    :rtype: [:class:`compare50.Span`]


    Determine which parts of ``file`` were stripped out by the preprocessor.
    """

    if original_tokens is None:
        original_tokens = file.unprocessed_tokens()
    if processed_tokens is None:
        processed_tokens = list(file.submission.preprocessor(original_tokens))

    if not original_tokens:
        return []

    file_start = original_tokens[0].start
    file_end = original_tokens[-1].end

    spans = []
    start = file_start
    for token in processed_tokens:
        if token.start != start:
            spans.append(Span(file, start, token.start))
        start = token.end

    if start < file_end:
        spans.append(Span(file, start, file_end))

    return spans


def expand(
    span_matches: List[Tuple[Span, Span]],
    tokens_a: List[Token],
    tokens_b: List[Token]
) -> List[Tuple[Span, Span]]:
    """
    :param span_matches: span pairs to be expanded wherein the first element of every \
            pair is from the same file and the second element of every pair is from the \
            same file
    :type span_matches: [(:class:`compare50.Span`, :class:`compare50.Span`)]
    :param tokens_a: the tokens of the file corresponding to the first element of each \
            ``span_match``
    :type tokens_a: [:class:`compare50.Token`]
    :param tokens_b: :param tokens_a: the tokens of the file corresponding to the first \
            element of each ``span_match``
    :type tokens_b: [:class:`compare50.Token`]
    :returns: A new list of maximially expanded span pairs
    :rtype: [(:class:`compare50.Span`, :class:`compare50.Span`)]

    Expand all span matches. This is useful when e.g. two spans in two different files
    are identical, but there are tokens before/after these spans that are also identical
    between the files. This function expands each of these spans to include these
    additional tokens.
    """
    if not span_matches:
        return span_matches

    expanded_span_matches: Set[Tuple[Span, Span]] = set()

    # Keep a list of tokens, sorted by the start (BisectList facilitates binary search)
    tokens_a_bisect = BisectList.from_sorted(tokens_a, key=lambda tok: tok.start)
    tokens_b_bisect = BisectList.from_sorted(tokens_b, key=lambda tok: tok.start)

    # Keep track of the intervals of the file covered by spans so that we can
    # avoid expanding span pairs that are already subsumed
    span_tree_a = intervaltree.IntervalTree()
    span_tree_b = intervaltree.IntervalTree()

    # Sort span matches first, to ensure that, if there are contiguous identical spans, we
    # start expanding the earliest span first.
    span_matches = sorted(span_matches, key=lambda match: (match[0].start, match[1].start))

    def is_subsumed(span: Span, tree: intervaltree.IntervalTree) -> bool:
        """Determine if span is contained by any interval in the tree.
        Assumes that tree contains no intersecting intervals"""
        intervals = tree[span.start:span.end]
        for interval in intervals:
            if span.start >= interval.begin and span.end <= interval.end:
                return True
        return False


    def _expand_side(cursor_a: int, cursor_b: int, step: int) -> Tuple[int, int]:
        """One-sided expansion. Given the start/end indices of a span pair,
        expand token-wise moving along the list of tokens according to ``step``.

        Returns a pair of indices corresponding to the new tokens"""

        tok_idx_a = tokens_a_bisect.bisect_key_right(cursor_a) - 2
        tok_idx_b = tokens_b_bisect.bisect_key_right(cursor_b) - 2

        try:
            while min(tok_idx_a, tok_idx_b) >= 0 and tokens_a_bisect[tok_idx_a] == tokens_b_bisect[tok_idx_b]:
                tok_idx_a += step
                tok_idx_b += step
        except IndexError:
            pass

        tok_idx_a -= step
        tok_idx_b -= step

        return tok_idx_a, tok_idx_b


    for span_a, span_b in span_matches:
        if is_subsumed(span_a, span_tree_a) and is_subsumed(span_b, span_tree_b):
            continue

        # Expand left
        start_a, start_b = _expand_side(span_a.start, span_b.start, -1)

        # Expand right
        end_a, end_b = _expand_side(span_a.end, span_b.end, 1)

        new_span_a = Span(span_a.file, tokens_a_bisect[start_a].start, tokens_a_bisect[end_a].end)
        new_span_b = Span(span_b.file, tokens_b_bisect[start_b].start, tokens_b_bisect[end_b].end)

        span_tree_a.addi(new_span_a.start, new_span_a.end)
        span_tree_b.addi(new_span_b.start, new_span_b.end)

        # Add new spans
        expanded_span_matches.add((new_span_a, new_span_b))

    # print(expanded_span_matches)
    return list(expanded_span_matches)


def _flatten_spans(spans: List[Span]) -> List[Span]:
    """
    Flatten a collection of spans.
    The resulting list of spans covers the same area and has no overlapping spans.
    """
    if len(spans) <= 1:
        return spans

    spans = sorted(spans, key=lambda span: span.start)
    file = spans[0].file

    flattened_spans: List[Span] = []
    start = spans[0].start
    cur = spans[0]
    for i in range(len(spans) - 1):
        next = spans[i + 1]
        if cur.end < next.start:
            flattened_spans.append(Span(file, start, cur.end))
            start = next.start
        if cur.end <= next.end:
            cur = next

    flattened_spans.append(Span(file, start, cur.end))
    return flattened_spans


def _group_span_matches(span_matches: List[Tuple[Span, Span]]) -> List[Group]:
    """
    Transforms a list of span pairs into a list of Groups.
    Finds all spans that share the same content, and groups them in one Group.
    returns a list of Groups.
    """
    if not span_matches:
        return []

    span_groups = _transitive_closure(span_matches)
    return _filter_subsumed_groups([Group(spans) for spans in span_groups])


def _transitive_closure(connections: List[Tuple[Any, Any]]) -> List[List[Any]]:
    class Graph:
        def __init__(self):
            self.connections = collections.defaultdict(set)

        def add(self, a, b):
            self.connections[a].add(b)
            self.connections[b].add(a)

        def traverse(self, node, visited=None):
            if visited is None:
                visited = set()

            visited.add(node)

            for other_node in self.connections[node]:
                if other_node not in visited:
                    self.traverse(other_node, visited)

            return visited

    graph = Graph()
    for a, b in connections:
        graph.add(a, b)

    trans_closure = []
    nodes = graph.connections.keys()
    while nodes:
        node = next(iter(nodes))
        reachable_nodes = graph.traverse(node)
        nodes -= reachable_nodes
        trans_closure.append(reachable_nodes)
    return trans_closure


def _is_span_subsumed(span: Span, other_spans: Iterable[Span]) -> bool:
    for other_span in other_spans:
        if span.start >= other_span.start and span.end <= other_span.end:
            return True
    return False


def _is_group_subsumed(group: Group, groups: Iterable[Group]) -> bool:
    for other_group in groups:
        if other_group == group or len(other_group.spans) < len(group.spans):
            continue

        for span in group.spans:
            if not _is_span_subsumed(span, filter(lambda other: span.file == other.file, other_group.spans)):
                break
        else:
            return True
    return False


def _filter_subsumed_groups(groups: Iterable[Group]) -> List[Group]:
    return [g for g in groups if not _is_group_subsumed(g, groups)]


class _ProgressBar:
    def __init__(self, msg: str="", total: float=100, disable: bool=False, **kwargs):
        self.msg = msg
        self.disable = disable
        if not disable:
            self._bar = tqdm.tqdm(total=total, dynamic_ncols=True, bar_format="{l_bar}{bar}|[{elapsed} {remaining}s]", **kwargs)
            self._bar.write(msg)
        else:
            self._n: float = 0
            self._total = total

    @property
    def n(self) -> float:
        try:
            return self._bar.n
        except AttributeError:
            return self._n

    @property
    def total(self) -> float:
        try:
            return self._bar.total
        except AttributeError:
            return self._n

    def reset(self, total: float=100) -> None:
        try:
            self._bar.reset(total=total)
        except AttributeError:
            self._n = 0
            self._total = total

    def update(self, amount: float=1) -> None:
        try:
            self._bar.update(amount)
        except AttributeError:
            self._n += amount

    def close(self, leave: bool=True) -> None:
        try:
            self._bar.close(leave)
        except AttributeError:
            pass

    def __enter__(self) -> tqdm.tqdm:
        try:
            self._bar.__enter__()
        except AttributeError:
            pass
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.update(self.total - self.n)
        try:
            self._bar.__exit__(exc_type, exc_val, exc_tb)
        except AttributeError:
            pass


_progress_bar = _ProgressBar(disable=True)


def init_progress_bar(*args, **kwargs) -> _ProgressBar:
    global _progress_bar
    _progress_bar = _ProgressBar(*args, **kwargs)
    return _progress_bar


def get_progress_bar() -> _ProgressBar:
    return _progress_bar


class FauxExecutor:
    """
    Executor (a la concurrent.futures.ProcessPoolExecutor) that runs tasks synchronously.
    Allows us to quickly deparallelize compare50 when debugging
    """
    class FauxFuture:
        """
        As above. A fake 'future' that wraps an already completed, synchronously executed task.
        """
        def __init__(self, result=None, exception=None):
            self._result = result
            self._exception = exception

        def cancel(self):
            return False

        def cancelled(self):
            return False

        def running(self):
            return False

        def result(self, timeout=None):
            if self._exception is not None:
                raise self._exception
            return self._result

        def exception(self, timeout=None):
            return self._exception

        def add_done_callback(fn):
            fn()

    def __init__(self, *_args, **_kwargs):
        pass

    def map(self, fn, *iterables, **_kwargs):
        for iterable in iterables:
            for res in map(fn, iterable):
                yield res

    def submit(self, fn, *args, **kwargs):
        try:
            result = fn(*args, **kwargs)
        except BaseException as e:
            return self.FauxFuture(exception=e)
        else:
            return self.FauxFuture(result=result)

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        return


#: Executor used for concurrency
Executor = concurrent.futures.ProcessPoolExecutor
