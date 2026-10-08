import pytest

from dbga_adapter import ANNOTATION_CALL, ANNOTATION_SYNTAX, parse_annotation


@pytest.mark.parametrize(
    "text, expected",
    [
        ("v@n", (None, "v", "n")),
        ("  list @ 16 ", (None, "list", "16")),
        ("heapSort:arr@size", ("heapSort", "arr", "size")),
        ("ptr->items@ptr->count", (None, "ptr->items", "ptr->count")),
        ("Stack::push:data@top + 1", ("Stack::push", "data", "top + 1")),
        ("ns::table@4", (None, "ns::table", "4")),
    ],
)
def test_valid_annotations(text, expected):
    assert parse_annotation(text) == (expected, None)


@pytest.mark.parametrize("text", ["v", "@n", "v@", "1fn:v@n", "my fn:v@n"])
def test_malformed_annotations(text):
    assert parse_annotation(text) == (None, ANNOTATION_SYNTAX)


@pytest.mark.parametrize("text", ["v@len(v)", "make()@4", "v@ size (x)"])
def test_function_calls_are_refused(text):
    assert parse_annotation(text) == (None, ANNOTATION_CALL)


def test_parentheses_for_grouping_are_allowed():
    assert parse_annotation("v@(n + 1)") == ((None, "v", "(n + 1)"), None)
