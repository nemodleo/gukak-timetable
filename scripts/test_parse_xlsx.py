#!/usr/bin/env python3
"""Unit tests for the pure helpers in parse_xlsx.py.

Run:  .venv/bin/python scripts/test_parse_xlsx.py
(needs openpyxl, same as the parser itself)
"""
import datetime
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse_xlsx as P  # noqa: E402


class ParseTimeLabel(unittest.TestCase):
    def test_plain_12h(self):
        self.assertEqual(P.parse_time_label("6:00AM ~ 8:00AM"), ("06:00", "08:00"))
        self.assertEqual(P.parse_time_label("3:30PM ~ 5:30PM"), ("15:30", "17:30"))
        self.assertEqual(P.parse_time_label("7:50PM ~ 9:50PM"), ("19:50", "21:50"))
        self.assertEqual(P.parse_time_label("11:00AM ~ 1:00PM"), ("11:00", "13:00"))

    def test_noon_and_midnight(self):
        self.assertEqual(P.parse_time_label("12:30PM ~ 2:30PM"), ("12:30", "14:30"))
        self.assertEqual(P.parse_time_label("12:00AM ~ 2:00AM"), ("00:00", "02:00"))

    def test_newlines_between_parts(self):
        self.assertEqual(
            P.parse_time_label("6:00AM\n~\n8:00AM"), ("06:00", "08:00")
        )

    def test_recovers_malformed_labels(self):
        # double colon + wrong AM/PM on a 24-hour value
        self.assertEqual(
            P.parse_time_label("17::30AM ~ 19:30AM"), ("17:30", "19:30")
        )
        self.assertEqual(
            P.parse_time_label("19:30PM ~ 21:30AM"), ("19:30", "21:30")
        )

    def test_24h_without_ampm(self):
        self.assertEqual(P.parse_time_label("09:00 ~ 11:00"), ("09:00", "11:00"))

    def test_short_but_valid_band(self):
        self.assertEqual(P.parse_time_label("8:30PM ~ 9:30PM"), ("20:30", "21:30"))

    def test_rejects_nonsense(self):
        for bad in ("", None, "lunch", "점심시간", "10:00 ~ 09:00", "06:00 ~ 12:00"):
            self.assertIsNone(P.parse_time_label(bad), bad)


class TimeHelpers(unittest.TestCase):
    def test_to24(self):
        self.assertEqual(P._to24(6, 0, "AM"), 360)
        self.assertEqual(P._to24(12, 0, "AM"), 0)
        self.assertEqual(P._to24(12, 30, "PM"), 12 * 60 + 30)
        self.assertEqual(P._to24(3, 30, "PM"), 15 * 60 + 30)
        self.assertEqual(P._to24(9, 0, None), 540)
        # already 24-hour -> AM/PM ignored
        self.assertEqual(P._to24(17, 30, "AM"), 17 * 60 + 30)

    def test_hm_mh_roundtrip(self):
        for s in ("06:00", "08:30", "23:00", "00:00", "17:30"):
            self.assertEqual(P._mh(P._hm(s)), s)


class MiscHelpers(unittest.TestCase):
    def test_ym_key(self):
        self.assertEqual(P.ym_key(2026, 7), "2026-07")
        self.assertEqual(P.ym_key(2026, 12), "2026-12")

    def test_file_month(self):
        self.assertEqual(P.file_month(Path("2026년 7월.xlsx")), 7)
        self.assertEqual(P.file_month(Path("2026년 3월(수정본).xlsx")), 3)
        self.assertEqual(P.file_month(Path("2026-09.xlsx")), 9)
        self.assertIsNone(P.file_month(Path("notes.xlsx")))

    def test_parse_header_date_picks_nearest_year(self):
        self.assertEqual(
            P.parse_header_date("Jul 01 (Wed)", 2026, 7),
            datetime.date(2026, 7, 1),
        )
        # Sep workbook, a week that spills back into August
        self.assertEqual(
            P.parse_header_date("Aug 31 (Mon)", 2026, 9),
            datetime.date(2026, 8, 31),
        )
        # January workbook, a "Dec" header belongs to the previous year
        self.assertEqual(
            P.parse_header_date("Dec 30", 2026, 1),
            datetime.date(2025, 12, 30),
        )
        self.assertIsNone(P.parse_header_date("garbage", 2026, 7))

    def test_looks_like_time_label(self):
        self.assertTrue(P.looks_like_time_label("6:00AM ~ 8:00AM"))
        self.assertFalse(P.looks_like_time_label("학생01 (교사AT)"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
