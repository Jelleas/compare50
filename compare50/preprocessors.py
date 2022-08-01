import re

from typing import Iterable

import attr
from pygments.token import Comment, Name, Number, String, Text, Keyword

from . import Token


def strip_whitespace(tokens: Iterable[Token]) -> Iterable[Token]:
    """Remove all whitespace from tokens."""
    for tok in tokens:
        val = tok.val
        if tok.type in Text:
            val = "".join(tok.val.split())
        if val:
            yield attr.evolve(tok, val=val)


def normalize_builtin_types(tokens: Iterable[Token]) -> Iterable[Token]:
    """Normalize builtin type names"""
    for tok in tokens:
        if tok.type in Keyword.Type:
            tok = attr.evolve(tok, val="t")
        yield tok


def strip_comments(tokens: Iterable[Token]) -> Iterable[Token]:
    """Remove all comments from tokens."""
    for tok in tokens:
        if tok.type not in (Comment.Multiline, Comment.Single, Comment.Hashbang):
            yield tok


def normalize_case(tokens: Iterable[Token]) -> Iterable[Token]:
    """Make all tokens lower case."""
    for tok in tokens:
        yield attr.evolve(tok, val=tok.val.lower())


def normalize_identifiers(tokens: Iterable[Token]) -> Iterable[Token]:
    """Replace all identifiers with ``v``"""
    for tok in tokens:
        if tok.type in Name:
            tok = attr.evolve(tok, val="v")
        yield tok


def normalize_string_literals(tokens: Iterable[Token]) -> Iterable[Token]:
    """Replace string literals with empty strings."""
    string_token = None
    for tok in tokens:
        if tok.type in String:
            if string_token is None:
                string_token = attr.evolve(tok, val='""')
            elif tok.type == string_token.type:
                string_token = attr.evolve(string_token, end=tok.end)
            else:
                yield string_token
                string_token = attr.evolve(tok, val='""')
        else:
            if string_token is not None:
                yield string_token
                string_token = None
            yield tok


def normalize_numeric_literals(tokens: Iterable[Token]) -> Iterable[Token]:
    """Replace numeric literals with their types."""
    for tok in tokens:
        if tok.type in Number.Integer:
            yield attr.evolve(tok, val="INT")
        elif tok.type in Number.Float:
            yield attr.evolve(tok, val="FLOAT")
        elif tok.type in Number:
            yield attr.evolve(tok, val="NUM")
        else:
            yield tok


def extract_identifiers(tokens: Iterable[Token]) -> Iterable[Token]:
    """Remove all tokens that don't represent identifiers."""
    for tok in tokens:
        if tok.type in Name:
            yield tok


def by_character(tokens: Iterable[Token]) -> Iterable[Token]:
    """Make a token for each character."""
    for tok in tokens:
        for i, c in enumerate(tok.val):
            yield attr.evolve(
                tok,
                start=tok.start + i,
                end=tok.start + i + 1,
                type=Text,
                val=c
            )


def token_printer(tokens: Iterable[Token]) -> Iterable[Token]:
    """Print each token. Useful for debugging."""
    for tok in tokens:
        print(tok)
        yield tok


def text_printer(tokens: Iterable[Token]) -> Iterable[Token]:
    """Print token values. Useful for debugging."""
    for tok in tokens:
        print(tok.val, end="")
        yield tok


def comments(tokens: Iterable[Token]) -> Iterable[Token]:
    """Remove all tokens that aren't comments."""
    for t in tokens:
        if t.type == Comment.Single or t.type == Comment.Multiline:
            yield t


def words(tokens: Iterable[Token]) -> Iterable[Token]:
    """Split tokens into tokens containing just one word."""
    for t in tokens:
        start = t.start
        only_alpha = re.sub("[^a-zA-Z'_-]", " ", t.val)
        for val, (start, end) in ((m.group(0), (m.start(), m.end())) for m in re.finditer(r'\S+', only_alpha)):
            yield attr.evolve(
                t,
                start=t.start + start,
                end=t.start + end,
                val=val
            )


def split_on_whitespace(tokens: Iterable[Token]) -> Iterable[Token]:
    """Split values of tokens on whitespace into new tokens"""
    for t in tokens:
        start = t.start
        for val, (start, end) in ((m.group(0), (m.start(), m.end())) for m in re.finditer(r'\S+', t.val)):
            yield attr.evolve(
                t,
                start=t.start + start, 
                end=t.start + end, 
                val=val
            )
