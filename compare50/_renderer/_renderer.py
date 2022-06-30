import collections
import pathlib
import pkg_resources

STATIC = pathlib.Path(pkg_resources.resource_filename("compare50._renderer", "static"))
TEMPLATES = pathlib.Path(pkg_resources.resource_filename("compare50._renderer", "templates"))

from typing import Dict, List

from ._cluster import Cluster
from .. import _api, Compare50Result, Pass
from ._home_renderer import render_home
from ._match_renderer import render_match

def render(pass_to_results: Dict[Pass, List[Compare50Result]], dest: str) -> pathlib.Path:
    dest = pathlib.Path(dest)

    # Map each match to its results
    sub_pair_to_results = collections.defaultdict(list)
    for results in pass_to_results.values():
        for result in results:
            sub_pair_to_results[(result.sub_a, result.sub_b)].append(result)

    progress_bar = _api.get_progress_bar()
    progress_bar.reset(total=len(sub_pair_to_results) + 20)

    # Create a cluster    
    cluster = Cluster(sub_pair_to_results)
    progress_bar.update(20)

    # Create the directory if it does not yet exist
    dest.mkdir(exist_ok=True)

    # Render matches
    for i, ((sub_a, sub_b), results) in enumerate(sub_pair_to_results.items()):
        subcluster = cluster.get_subcluster(sub_a)

        metadata = {
            "index": i + 1,
            "numberOfMatches": len(sub_pair_to_results)
        }

        match = render_match(sub_a, sub_b, results, subcluster, metadata)

        with open(dest / f"match_{i + 1}.html", "w") as f:
            f.write(match)

        progress_bar.update()

    # Render home page
    home = render_home(cluster)
    home_path = dest / "home.html"
    with open(home_path, "w") as f:
        f.write(home)

    return home_path

