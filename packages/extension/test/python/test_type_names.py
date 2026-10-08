import pytest

from dbga_adapter import canonical_type_name


@pytest.mark.parametrize(
    "gdb, lldb, expected",
    [
        ("struct Node *", "Node *", "Node *"),
        ("Node *", "Node*", "Node *"),
        ("struct Node **", "Node * *", "Node **"),
        ("int [16]", "int[16]", "int[16]"),
        ("const char *", "char const*", "char *"),
        ("_Bool", "bool", "bool"),
        ("enum Color", "Color", "Color"),
        ("class Shape &", "Shape &", "Shape &"),
        ("int (*)(int, char)", "int (*)(int,char)", "int(*)(int,char)"),
    ],
)
def test_both_debuggers_spell_a_type_the_same_way(gdb, lldb, expected):
    assert canonical_type_name(gdb) == expected
    assert canonical_type_name(lldb) == expected


def test_qualifiers_and_extra_spaces_are_dropped():
    assert canonical_type_name("volatile unsigned  int") == "unsigned int"


def test_scope_operators_stay_inside_the_name():
    assert canonical_type_name("std::size_t") == "std::size_t"


def test_a_lone_keyword_is_kept():
    assert canonical_type_name("struct") == "struct"


def test_none_stays_none():
    assert canonical_type_name(None) is None
