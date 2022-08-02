
import typing
from typing import List, Set, Dict, Tuple, Type, Callable, Union

import abc
from collections.abc import Mapping, Sequence
from collections import defaultdict
import pathlib
import numbers

import attr
import pygments
import pygments.lexers


__all__ = ["Pass", "Comparator", "Explainer", "Explanation", "File", "FileSubmission",
           "FingerprintSubmission", "Submission", "Span", "Score", "Compare50Result", "Comparison",
            "Token", "Fingerprint", "SourcedFingerprint", "clear_all_caches"]

_caches: List[Tuple[Type, str, Callable]] = []

def cached_class(*args):
    """
    Decorator for a class with caches (state). Use as follows:
    @cached_class(("property_name", lambda: "callback_that_produces_initial_value"))
    All caches can be cleared by calling `clear_all_caches()`
    """
    def decorator(cls):
        for arg, clear_callback in args:
            setattr(cls, arg, clear_callback())
            _caches.append((cls, arg, clear_callback))
        return cls
    return decorator


def clear_all_caches():
    """Clear all caches of classes decorated by cached_class."""
    for cls, arg, clear_callback in _caches:
        setattr(cls, arg, clear_callback())


class _PassRegistry(abc.ABCMeta):
    passes: Dict[str, Type] = {}

    def __new__(mcls, name, bases, attrs):
        cls = abc.ABCMeta.__new__(mcls, name, bases, attrs)

        if attrs.get("_{}__register".format(name), True):
            _PassRegistry.passes[name] = cls

        return cls

    @staticmethod
    def _get(name):
        return _PassRegistry.passes[name]

    @staticmethod
    def _get_all():
        return list(_PassRegistry.passes.values())


class Pass(metaclass=_PassRegistry):
    """
    Abstract base class for ``compare50`` passes, which are essentially ways for
    ``compare50`` to compare submissions. Subclasses must define a list of preprocessors
    (functions from tokens to tokens which will be run on every file ``compare50``
    recieves) as well as a comparator (used to score and compare the preprocessed
    submissions).
    """
    __register = False

    # Whether or not the pass should be enabled by default
    default = False

    # Whether or not the pass should be run in parallel
    parallel = True

    @property
    @abc.abstractmethod
    def preprocessors(self) -> List[Callable[[List["Token"]], List["Token"]]]:
        pass
    
    @property
    @abc.abstractmethod
    def comparator(self) -> Union["Comparator", "ServerComparator"]:
        pass

    explainers: List["Explainer"] = []


class Comparator(metaclass=abc.ABCMeta):
    """
    Abstract base class for ``compare50`` comparators which specify how submissions
    should be scored and compared.
    """
    @abc.abstractmethod
    def score(self, submissions, archive_submissions, ignored_files):
        """
        Given a list of submissions, a list of archive submissions, and a set of distro
        files, return a list of :class:`compare50.Score`\ s for each submission pair.
        """
        pass

    @abc.abstractmethod
    def compare(self, scores, ignored_files):
        """
        Given a list of scores and a list of distro files, perform an in-depth
        comparison of each submission pair and return a corresponding list of
        :class:`compare50.Comparison`\ s
        """
        pass

    @abc.abstractmethod
    def fingerprint_for_score(self, file: "File") -> List["Fingerprint"]:
        pass

    @abc.abstractmethod
    def fingerprint_for_compare(self, file: "File") -> List["SourcedFingerprint"]:
        pass


class ServerComparator(Comparator):
    """
    An extended comparator that is capable of ranking FingerprintSubmissions.
    In other words, submissions that are composed of fingerprints only and not directories and files.
    """
    def score_fingerprints(
        self, 
        submissions: List["FingerprintSubmission"], 
        archive_submissions: List["FingerprintSubmission"],
        ignored: Set["Fingerprint"]
    ):
        pass


    @abc.abstractmethod
    def compare_fingerprints(self, scores, ignored_fingerprints):
        """
        Given a list of scores and a list of distro files, perform an in-depth
        comparison of each submission pair and return a corresponding list of
        :class:`compare50.Comparison`\ s
        """
        pass


class Explainer(metaclass=abc.ABCMeta):
    @property
    @abc.abstractmethod
    def name(self) -> str:
        pass

    @abc.abstractmethod
    def explain(
        self, 
        comparator: Comparator,
        results: List["Compare50Result"], 
        submissions: List["FileSubmission"], 
        archive_submissions: List["FileSubmission"], 
        ignored_files: Set["File"]
    ) -> List["Explanation"]:
        pass


class IdStore(Mapping):
    """
    Mapping from objects to IDs. If object has not been added to the store,
    a new id is generated for it.
    """
    def __init__(self, key=lambda obj: obj):
        self.objects = []
        self._key = key
        self._ids = {}

    def __getitem__(self, obj) -> int:
        key = self._key(obj)
        if key not in self._ids:
            self._ids[key] = len(self.objects)
            self.objects.append(obj)
        return self._ids[key]

    def __iter__(self):
        return iter(self.objects.values())

    def __len__(self):
        return len(self.objects)


def _to_path_tuple(fs):
    """
    Convert iterable yielding strings to tuple containing paths.
    Ideally we could use an attrs converter decorator,but it doesn't exist yet
    https://github.com/python-attrs/attrs/pull/404
    """
    return tuple(map(pathlib.Path, fs))


@attr.s(slots=True, frozen=True)
class Fingerprint:
    """A comparable and hashable fingerprint."""
    value = attr.ib()
    submission_id = attr.ib(cmp=False, hash=False)


@attr.s(slots=True, frozen=True)
class SourcedFingerprint:
    """A Fingerprint with a source (a Span)."""
    value = attr.ib()
    span = attr.ib(cmp=False, hash=False)


class Submission(metaclass=abc.ABCMeta):
    """Abstract base class for Submissions."""
    @property
    @abc.abstractmethod
    def id(self):
        pass   

    @property
    @abc.abstractmethod
    def is_archive(self):
        pass

    @abc.abstractclassmethod
    def get(cls, id):
        pass


@cached_class(
    ("_store", lambda: IdStore(key=lambda sub: (sub.path, sub.files, sub.large_files, sub.undecodable_files)))
)
@attr.s(slots=True, frozen=True)
class FileSubmission(Submission):
    """
    :ivar path: the file path of the submission
    :ivar files: list of :class:`compare50.File` objects contained in the submission
    :ivar preprocessor: A function from tokens to tokens that will be run on \
            each file in the submission
    :ivar id: integer that uniquely identifies this submission \
            (submissions with the same path will always have the same id).

    Represents a single submission. Submissions may either be single files or
    directories containing many files.
    """
    path = attr.ib(converter=pathlib.Path, cmp=False)
    files = attr.ib(cmp=False)
    large_files = attr.ib(factory=tuple, converter=_to_path_tuple, cmp=False, repr=False)
    undecodable_files = attr.ib(factory=tuple, converter=_to_path_tuple, cmp=False, repr=False)
    preprocessor = attr.ib(default=lambda tokens: tokens, cmp=False, repr=False)
    is_archive = attr.ib(default=False, cmp=False)
    id = attr.ib(init=False)

    def __attrs_post_init__(self):
        object.__setattr__(self, "files", tuple(
            [File(pathlib.Path(path), self) for path in self.files]))
        object.__setattr__(self, "id", FileSubmission._store[self])

    def __iter__(self):
        return iter(self.files)

    @classmethod
    def get(cls, id):
        """Retrieve submission corresponding to specified id"""
        return cls._store.objects[id]


@cached_class(
    ("_store", lambda: IdStore(key=lambda sub: (sub.submitter, sub.version, sub.slug)))
)
@attr.s(slots=True, frozen=True)
class FingerprintSubmission(Submission):
    """
    :ivar fingerprints: A set of fingerprints generated earlier for this submission.
    :ivar id: integer that uniquely identifies this submission \
            (submissions with the same path will always have the same id).

    Represents a single submission consisting of only fingerprints. 
    """
    submitter = attr.ib(cmp=False)
    version = attr.ib(cmp=False)
    slug = attr.ib(cmp=False)
    fingerprints = attr.ib(cmp=False)
    is_archive = attr.ib(default=False, cmp=False)
    id = attr.ib(init=False)

    def __attrs_post_init__(self):
        object.__setattr__(self, "id", FingerprintSubmission._store[self])
        object.__setattr__(self, "fingerprints", [Fingerprint(fingerprint, self.id) for fingerprint in self.fingerprints])

    def __iter__(self):
        return iter(self.fingerprints)

    @classmethod
    def get(cls, id):
        """Retrieve submission corresponding to specified id"""
        return cls._store.objects[id]


@cached_class(
    ("_lexer_cache", dict),
    ("_unprocessed_token_cache", dict),
    ("_store", lambda: IdStore(key=lambda file: file.path))
)
@attr.s(slots=True, frozen=True)
class File:
    """
    :ivar name: file name (path relative to the submission path)
    :ivar submission: submission containing this file
    :ivar id: integer that uniquely identifies this file (files with the same path \
            will always have the same id)


    Represents a single file from a submission.
    """
    _lexer_cache: Dict[str, "pygments.lexers.Lexer"]
    _unprocessed_token_cache: Dict
    _store: IdStore

    name = attr.ib(converter=pathlib.Path, cmp=False)
    submission = attr.ib(cmp=False)
    id = attr.ib(default=attr.Factory(lambda self: self._store[self], takes_self=True), init=False)

    @property
    def path(self) -> pathlib.Path:
        """The full path of the file"""
        return self.submission.path / self.name

    def read(self, size: int=-1) -> str:
        """Open file, read ``size`` bytes from it, then close it."""
        with open(self.path) as f:
            return f.read(size)

    def tokens(self) -> List["Token"]:
        """Returns the prepocessed tokens of the file."""
        return list(self.submission.preprocessor(self.unprocessed_tokens()))

    def lexer(self) -> "pygments.lexers.Lexer":
        """Determine which Pygments lexer should be used."""
        ext = self.name.suffix
        try:
            return self._lexer_cache[ext]
        except KeyError:
            pass

        # get lexer for this file type
        try:
            lexer = pygments.lexers.get_lexer_for_filename(self.name.name)
            self._lexer_cache[ext] = lexer
            return lexer
        except pygments.util.ClassNotFound:
            try:
                return pygments.lexers.guess_lexer(self.read())
            except pygments.util.ClassNotFound:
                return pygments.lexers.special.TextLexer()

    @classmethod
    def get(cls, id: int) -> "File":
        """Find File with given id."""
        return cls._store.objects[id]

    def unprocessed_tokens(self) -> List["Token"]:
        """Get the raw tokens of the file."""
        tokens = self._unprocessed_token_cache.get(self.id)
        if not (tokens is None):
            return tokens

        text = self.read()
        lexer_tokens = self.lexer().get_tokens_unprocessed(text)
        tokens = []
        prevToken = None
        for token in lexer_tokens:
            if prevToken:
                tokens.append(Token(start=prevToken[0], end=token[0],
                                    type=prevToken[1], val=prevToken[2]))

            prevToken = token

        if prevToken:
            tokens.append(Token(start=prevToken[0], end=len(text),
                                type=prevToken[1], val=prevToken[2]))

        self._unprocessed_token_cache[self.id] = tokens
        return tokens


@attr.s(slots=True)
class Preprocessor:
    """Hack to ensure that composed preprocessor is serializable by Pickle."""
    preprocessors = attr.ib()

    def __call__(self, tokens):
        for preprocessor in self.preprocessors:
            tokens = preprocessor(tokens)
        return tokens


@attr.s(slots=True, frozen=True, repr=False)
class Span:
    """
    :ivar file: the ID of the File containing the span
    :ivar start: the character index of the first character in the span
    :ivar end: the character index one past the end of the span


    Represents a range of characters in a particular file.
    """
    file = attr.ib()
    start = attr.ib()
    end = attr.ib()

    def __repr__(self):
        return "Span({} {}:{})".format(self.file.path.relative_to(self.file.submission.path.parent), self.start, self.end)

    def __contains__(self, other):
        return self.file == other.file and self.start <= other.start and self.end >= other.end

    def _raw_contents(self):
        return self.file.read()[self.start:self.end]


@attr.s(slots=True)
class Comparison:
    """
    :ivar sub_a: the first submission
    :ivar sub_b: the second submission
    :ivar span_matches: a list of pairs of matching :class:`compare50.Span`\ s, wherein \
            the first element of each pair is from ``sub_a`` and the second is from \
            ``sub_b``.
    :ivar ignored_spans: a list of :class:`compare50.Span`\ s which were ignored \
            (e.g. because they matched distro files)

    Represents an in-depth comparison of two submissions.
    """
    sub_a = attr.ib(validator=attr.validators.instance_of(Submission))
    sub_b = attr.ib(validator=attr.validators.instance_of(Submission))
    span_matches = attr.ib(factory=list)
    ignored_spans = attr.ib(factory=list)


@attr.s(slots=True)
class Score:
    """
    :ivar sub_a: the first submission
    :ivar sub_b: the second submission
    :ivar score: a number indicating the similarity between ``sub_a`` and ``sub_b``\
            (higher meaning more similar)

    A score representing the similarity of two submissions.
    """
    sub_a = attr.ib(validator=attr.validators.instance_of(Submission), cmp=False)
    sub_b = attr.ib(validator=attr.validators.instance_of(Submission), cmp=False)

    # Remove ignore once https://github.com/python/mypy/issues/3186 is fixed
    score: numbers.Number = attr.ib(default=0, validator=attr.validators.instance_of(numbers.Number)) # type: ignore

@attr.s(slots=True)
class Compare50Result:
    """
    :ivar pass_: the pass that was used to compare the two submissions
    :ivar score: the :class:`compare50.Score` generated when the submissions were scored
    :ivar groups: a list of groups of matching spans
    :ivar ignored_spans: a list of spans that were ignored during the comparison

    The final result of comparing two submissions that is passed to the renderer.
    """
    pass_: Pass = attr.ib()
    score: Score = attr.ib()
    groups: List["Group"] = attr.ib()
    ignored_spans: List[Span] = attr.ib()
    explanations: Dict[Explainer, List["Explanation"]] = attr.ib(init=False, factory=lambda: defaultdict(list))

    @property
    def name(self):
        """The name of the pass that was run to compare the submissions."""
        return self.pass_.__name__

    @property
    def sub_a(self):
        """The 'first' (left) submission"""
        return self.score.sub_a

    @property
    def sub_b(self):
        """The 'second' (right) submission"""
        return self.score.sub_b

    def add_explanation(self, explanation: "Explanation"):
        """Add an explanation to this result."""
        self.explanations[explanation.explainer].append(explanation)


def _sorted_subs(group):
    sub = None
    for span in group.spans:
        if not sub:
            sub = span.file.submission
        elif sub < span.file.submission:
            return (sub, span.file.submission)
        elif sub > span.file.submission:
            return (span.file.submission, sub)


@attr.s(slots=True)
class Explanation:
    """
    :ivar span: the explained span
    :ivar text: the explanation in text form
    :ivar weight: a normalized score from 0 to 1 signifying how relevant this span is
    :ivar explainer: the creator of this explanation
    """
    span: Span = attr.ib(validator=attr.validators.instance_of(Span))
    text: str = attr.ib(validator=attr.validators.instance_of(str))
    weight: float = attr.ib(validator=attr.validators.instance_of(float))
    explainer: Explainer = attr.ib(validator=attr.validators.instance_of(Explainer))


@attr.s(slots=True, frozen=True)
class Group:
    """
    :ivar spans: spans with identical contents

    A group of spans with matching contents
    """
    spans: typing.FrozenSet[Span] = attr.ib(converter=frozenset)
    _subs: List[Submission] = attr.ib(init=False, default=attr.Factory(_sorted_subs, takes_self=True))

    @property
    def sub_a(self):
        """The 'first' submission represented in the group (i.e. the one with
        the smaller identifier)"""
        return self._subs[0]

    @property
    def sub_b(self):
        """The 'second' submission represented in the group (i.e. the one with
        the larger identifier)"""
        return self._subs[1]


@attr.s(slots=True)
class Token:
    """
    :ivar start: the character index of the beginning of the token
    :ivar end: the character index one past the end of the token
    :ivar type: the Pygments token type
    :ivar val: the string contents of the token

    A result of the lexical analysis of a file. Preprocessors operate
    on Token streams.
    """
    start = attr.ib(cmp=False)
    end = attr.ib(cmp=False)
    type = attr.ib()
    val = attr.ib()

    def __eq__(self, other):
        # Note that there is no sanity checking. Sacrificed for performance.
        return self.val == other.val and self.type == other.type


class BisectList(Sequence):
    """
    A sorted list allowing for easy binary seaching. This exists because Python's
    bisect does not allow you to compare objects via a key function.
    """
    def __init__(self, iter=None, key=lambda x: x):
        self.contents = sorted(iter, key=key) if iter is not None else []
        self.key = key

    @classmethod
    def from_sorted(cls, iter=None, key=lambda x: x):
        s_list = BisectList(key=key)
        if iter is not None:
            s_list.contents = list(iter)
        return s_list

    def __len__(self):
        return len(self.contents)

    def __getitem__(self, idx):
        return self.contents[idx]

    def bisect_key_right(self, x):
        lo = 0
        hi = len(self.contents)

        while lo < hi:
            mid = (lo + hi) // 2
            if x < self.key(self.contents[mid]):
                hi = mid
            else:
                lo = mid + 1
        return lo

    def bisect_key_left(self, x):
        lo = 0
        hi = len(self.contents)

        while lo < hi:
            mid = (lo + hi) // 2
            if self.key(self.contents[mid]) < x:
                lo = mid + 1
            else:
                hi = mid
        return lo
