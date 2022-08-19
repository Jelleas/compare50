import unittest
import tempfile
import os

import compare50._data as data
import compare50._api as api
import compare50._renderer as renderer
from compare50.comparators import Winnowing

class TestSingleSourceComparison(unittest.TestCase):
    def setUp(self):
        self.working_directory = tempfile.TemporaryDirectory()
        self._wd = os.getcwd()
        os.chdir(self.working_directory.name)

        self.pass_ = data.Pass._get("structure")
        self.comparator = Winnowing(k=2, t=2)

        self.content_a = "def foo():\n"\
                    "    print('qux')\n"
        with open("foo.py", "w") as f:
            f.write(self.content_a)

        self.content_b = "def bar():\n"\
                    "    print('qux')\n"
        with open("bar.py", "w") as f:
            f.write(self.content_b)

        self.file_sub = data.FileSubmission(".", ["foo.py"])
        
        temp_sub = data.FileSubmission(".", ["bar.py"])
        fingerprints = []
        for file in temp_sub.files:
            fingerprints.extend(self.comparator.fingerprint_for_compare(file))

        self.fingerprint_sub = data.FingerprintSubmission("b", 0, "bar/slug", fingerprints)

    def tearDown(self):
        self.working_directory.cleanup()
        os.chdir(self._wd)

    def test_compare_fingerprints(self):
        score = data.Score(self.file_sub, self.fingerprint_sub, 1)
        comparison: data.SingleSourceComparison = self.comparator.compare_fingerprints([score], set())[0]

        self.assertEqual(len(comparison.matching_spans), 12)

    def test_render(self):
        score = data.Score(self.file_sub, self.fingerprint_sub, 1)
        comparison: data.SingleSourceComparison = self.comparator.compare_fingerprints([score], set())[0]
        groups = [data.Group((span, )) for span in comparison.matching_spans]
        result = data.Compare50Result(self.pass_, score, groups, comparison.ignored_spans)

        with api.init_progress_bar("Rendering", disable=True):
            renderer.render({self.pass_: [result]}, dest=".")

if __name__ == '__main__':
    unittest.main()
