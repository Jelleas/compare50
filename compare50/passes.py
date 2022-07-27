from pkg_resources import resource_filename
from typing import List, Callable

from . import comparators, preprocessors, explainers
from ._data import Pass, Token

__all__ = ["structure", "text", "exact", "nocomments", "misspellings"]


class structure(Pass):
    """Compares code structure by removing whitespace and comments; normalizing variable names, string literals, and numeric literals; and then running the winnowing algorithm."""
    default = True
    parallel = False # uniqueness explainer needs access to all tokens, best to disable concurrency to allow for caching
    preprocessors = [preprocessors.strip_whitespace,
                     preprocessors.strip_comments,
                     preprocessors.normalize_identifiers,
                     preprocessors.normalize_builtin_types,
                     preprocessors.normalize_string_literals,
                     preprocessors.normalize_numeric_literals]
    comparator = comparators.Winnowing(k=25, t=35)
    explainers = [explainers.Uniqueness()]


class text(Pass):
    """Removes whitespace, then uses the winnowing algorithm to compare submissions."""
    default = True
    preprocessors = [preprocessors.split_on_whitespace,
                     preprocessors.strip_whitespace]
    comparator = comparators.Winnowing(k=25, t=35)


class exact(Pass):
    """Removes nothing, not even whitespace, then uses the winnowing algorithm to compare submissions."""
    default = True
    preprocessors: List[Callable[[List["Token"]], List["Token"]]] = []
    comparator = comparators.Winnowing(k=25, t=35)


class nocomments(Pass):
    """Removes comments, but keeps whitespace, then uses the winnowing algorithm to compare submissions."""
    preprocessors = [preprocessors.strip_comments, preprocessors.split_on_whitespace]
    comparator = comparators.Winnowing(k=25, t=35)


class misspellings(Pass):
    """Compares comments for identically misspelled English words."""
    preprocessors = [preprocessors.comments,
                     preprocessors.normalize_case,
                     preprocessors.words]
    comparator = comparators.Misspellings(resource_filename("compare50.comparators",
                                                            "english_dictionary.txt"))
