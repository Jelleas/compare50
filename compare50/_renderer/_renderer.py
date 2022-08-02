import collections
import pathlib
import json
from re import sub
import pkg_resources

STATIC = pathlib.Path(pkg_resources.resource_filename("compare50._renderer", "static"))
TEMPLATES = pathlib.Path(pkg_resources.resource_filename("compare50._renderer", "templates"))

from typing import Dict, List, Union, Any

from ._cluster import Cluster
from .. import _api, Compare50Result, Pass
from ._home_renderer import get_home_data
from ._match_renderer import get_match_data

import jinja2


def render(
    pass_to_results: Dict[Pass, List[Compare50Result]],
    dest: Union[str, pathlib.Path], 
    bundled: bool=False
) -> pathlib.Path:
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

    return _render_multi(sub_pair_to_results, cluster, dest)


def _render_multi(
    sub_pair_to_results: Dict[Pass, List[Compare50Result]],
    cluster: Cluster,
    dest: pathlib.Path
) -> str:
    progress_bar = _api.get_progress_bar()

    # Render matches
    for i, ((sub_a, sub_b), results) in enumerate(sub_pair_to_results.items()):
        subcluster = cluster.get_subcluster(sub_a)

        index = i + 1

        metadata = {
            "index": index,
            "numberOfMatches": len(sub_pair_to_results)
        }

        match_data = get_match_data(sub_a, sub_b, results, subcluster, metadata)

        # match = _render_page({"matches": {index: match_data}}, "match.html")

        match = _render_page(match_data, "match.html")

        with open(dest / f"match_{index}.html", "w") as f:
            f.write(match)

        progress_bar.update()

    # Render home page
    data = get_home_data(cluster)
    home = _render_page(data, "home.html")

    home_path = dest / "index.html"
    with open(home_path, "w") as f:
        f.write(home)

    return home_path


def _render_bundled(
    sub_pair_to_results: Dict[Pass, List[Compare50Result]],
    cluster: Cluster,
    dest: pathlib.Path
) -> str:
    progress_bar = _api.get_progress_bar()

    matches_data = {}

    # Render matches
    for i, ((sub_a, sub_b), results) in enumerate(sub_pair_to_results.items()):
        subcluster = cluster.get_subcluster(sub_a)

        index = i + 1

        metadata = {
            "index": index,
            "numberOfMatches": len(sub_pair_to_results)
        }

        matches_data[index] = get_match_data(sub_a, sub_b, results, subcluster, metadata)

        progress_bar.update()

    # Render home page
    home_data = render_home_data(cluster)

    data = {
        "matches": matches_data 
        **home_data,
    }

    page = _render_page(data, "bundle.html")

    home_path = dest / "index.html"
    with open(home_path, "w") as f:
        f.write(page)

    return home_path


def _render_page(data: Any, filename: str) -> str:
    with open(TEMPLATES / "page.html") as f:
        template = jinja2.Template(f.read(), autoescape=jinja2.select_autoescape(enabled_extensions=("html",)))
    rendered_data = template.render(DATA=data)

    with open(STATIC / filename) as f:
        page = f.read()
    return f"{rendered_data}\n{page}"