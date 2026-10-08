import math
import struct

import pytest

from dbga_adapter import char_text, cut_text, decode_real


def x87(sign, exponent, mantissa):
    return mantissa.to_bytes(8, "little") + ((sign << 15) | exponent).to_bytes(2, "little")


@pytest.mark.parametrize("value", [0.0, 1.5, -2.25, 1e-30, 3.4e38])
def test_float_round_trips(value):
    decoded, special = decode_real(struct.pack("<f", value), 4)

    assert special is None
    assert decoded == struct.unpack("<f", struct.pack("<f", value))[0]


@pytest.mark.parametrize("value", [0.0, math.pi, -1e300, 5e-324])
def test_double_round_trips(value):
    assert decode_real(struct.pack("<d", value), 8) == (value, None)


@pytest.mark.parametrize(
    "raw, size, expected",
    [
        (struct.pack("<d", math.inf), 8, (None, "inf")),
        (struct.pack("<d", -math.inf), 8, (None, "-inf")),
        (struct.pack("<d", math.nan), 8, (None, "nan")),
        (struct.pack("<f", math.nan), 4, (None, "nan")),
    ],
)
def test_specials_leave_the_number_empty(raw, size, expected):
    assert decode_real(raw, size) == expected


@pytest.mark.parametrize(
    "raw, expected",
    [
        (x87(0, 16383, 1 << 63), (1.0, None)),
        (x87(1, 16384, 3 << 62), (-3.0, None)),
        (x87(0, 0x7FFF, 1 << 63), (None, "inf")),
        (x87(1, 0x7FFF, 1 << 63), (None, "-inf")),
        (x87(0, 0x7FFF, (1 << 63) | 1), (None, "nan")),
        (x87(0, 0, 0), (0.0, None)),
    ],
)
def test_x87_long_double_is_narrowed_from_raw_bytes(raw, expected):
    assert decode_real(raw, 16) == expected
    assert decode_real(raw + b"\x00\x00", 12) == expected


def test_x87_beyond_double_range_becomes_infinite():
    assert decode_real(x87(0, 0x7FFE, 1 << 63), 16) == (None, "inf")


@pytest.mark.parametrize("raw, size", [(None, 8), (b"\x00" * 3, 4), (b"\x00" * 8, 6)])
def test_unknown_sizes_and_short_buffers_give_nothing(raw, size):
    assert decode_real(raw, size) == (None, None)


@pytest.mark.parametrize(
    "value, width, expected",
    [
        (65, 1, "A"),
        (10, 1, "\\x0a"),
        (-1, 1, "\\xff"),
        (0xE9, 4, "é"),
        (0x7, 2, "\\u0007"),
        (0xD800, 2, "\\ud800"),
        (0x1F600, 4, "😀"),
        (0x110000, 4, "\\U00110000"),
    ],
)
def test_char_text_escapes_what_cannot_be_printed(value, width, expected):
    assert char_text(value, width) == expected


def test_int8_and_uint8_read_as_the_same_byte():
    assert char_text(-56, 1) == char_text(200, 1)


def test_cut_text_stops_at_the_first_nul():
    assert cut_text(b"abc\x00def") == ("abc", False)


def test_cut_text_without_nul_is_truncated():
    assert cut_text(b"abcdef") == ("abcdef", True)


def test_cut_text_replaces_invalid_utf8():
    text, _ = cut_text(b"\xffok\x00")

    assert text == "�ok"


def test_cut_text_of_nothing():
    assert cut_text(None) == ("", False)
