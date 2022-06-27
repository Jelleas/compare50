from .. import Explainer, Explanation, Compare50Result, Submission, File, Pass

class Uniqueness(Explainer):
    name = "uniqueness"

    def __init__(self) -> None:
        pass

    def explain(
        self, 
        results: list[Compare50Result], 
        submissions: list[Submission], 
        archive_submissions: list[Submission], 
        ignored_files: set[File], 
        pass_: Pass
    ) -> list[Explanation]:
        for result in results:
            pass
        
        return []

    